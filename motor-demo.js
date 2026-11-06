/* Motor del modo demostración — generado automáticamente, no editar */
var MotorDemo = (function () {
/* =====================================================================
   NÚCLEO — III Encuentro Empresarial (ANI · UNIPAZ)
   Lógica común: la usa Apps Script (Code.gs) y el modo demostración.
   Necesita dos objetos que define cada plataforma:
     BD   -> leer(hoja), agregar(hoja, obj), actualizar(hoja, fila, cambios), borrar(hoja, fila)
     PLAT -> sha256(txt), hmac(txt, clave), prop(k), setProp(k, v), cacheGet(k), cachePut(k, v, seg),
             ahoraMs(), hoy(), ahoraTexto(), fechaTexto(v), uuid(), conBloqueo(fn)
   ===================================================================== */

var HOJAS = {
  CONFIG: 'Config', USUARIOS: 'Usuarios', COMISIONES: 'Comisiones', TAREAS: 'Tareas',
  AVANCE: 'Avance', MENSAJES: 'Mensajes', DOCUMENTOS: 'Documentos'
};

var COLUMNAS = {
  Config: ['clave', 'valor', 'nota'],
  Usuarios: ['cedula', 'nombre', 'rol', 'comision', 'lider', 'empresa', 'clave_hash', 'cambiar_clave', 'ultimo_ingreso'],
  Comisiones: ['numero', 'nombre', 'color'],
  Tareas: ['id', 'tipo', 'comision', 'titulo', 'descripcion', 'fecha_limite', 'orden', 'activa'],
  Avance: ['tarea_id', 'ambito', 'marcado_por', 'nombre', 'fecha'],
  Mensajes: ['id', 'fecha', 'cedula', 'nombre', 'rol', 'texto', 'aviso', 'oculto'],
  Documentos: ['orden', 'titulo', 'descripcion', 'enlace', 'categoria']
};

var ROLES_EQUIPO = ['DOCENTE', 'COORDINADOR'];
var MAX_INTENTOS = 8;

/* ---------- utilidades ---------- */
function s(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function siNo(v) { return s(v).toUpperCase() === 'SI' || s(v).toUpperCase() === 'SÍ'; }
function num(v) { var n = parseInt(s(v), 10); return isNaN(n) ? 0 : n; }
function falla(msg, codigo) { var e = new Error(msg); e.mensaje = msg; e.codigo = codigo || ''; throw e; }
function limpiarCedula(v) { return s(v).replace(/[.\s]/g, ''); }
function esEquipo(u) { return ROLES_EQUIPO.indexOf(s(u.rol).toUpperCase()) >= 0; }

function config() {
  var c = {};
  BD.leer(HOJAS.CONFIG).forEach(function (r) { if (s(r.clave)) c[s(r.clave)] = r.valor; });
  return c;
}

function secreto() {
  var k = PLAT.prop('SECRETO');
  if (!k) { k = PLAT.uuid() + PLAT.uuid(); PLAT.setProp('SECRETO', k); }
  return k;
}

function hashClave(cedula, clave) { return PLAT.sha256(secreto() + '|' + cedula + '|' + clave); }

function crearToken(cedula) {
  var exp = PLAT.ahoraMs() + 1000 * 60 * 60 * 24 * 10; // 10 días
  var base = cedula + '|' + exp;
  return base + '|' + PLAT.hmac(base, secreto());
}

function cedulaDesdeToken(token) {
  var p = s(token).split('|');
  if (p.length !== 3) return '';
  var base = p[0] + '|' + p[1];
  if (PLAT.hmac(base, secreto()) !== p[2]) return '';
  if (Number(p[1]) < PLAT.ahoraMs()) return '';
  return p[0];
}

function buscarUsuario(cedula) {
  var lista = BD.leer(HOJAS.USUARIOS);
  for (var i = 0; i < lista.length; i++) {
    if (s(lista[i].cedula) && limpiarCedula(lista[i].cedula) === cedula) return lista[i];
  }
  return null;
}

function usuarioSesion(p, permitirCambio) {
  var ced = cedulaDesdeToken(p.token);
  if (!ced) falla('Tu sesión terminó. Vuelve a ingresar.', 'SESION');
  var u = buscarUsuario(ced);
  if (!u) falla('Tu usuario ya no está registrado.', 'SESION');
  if (!permitirCambio && (!s(u.clave_hash) || siNo(u.cambiar_clave))) falla('Debes cambiar tu clave antes de continuar.', 'CAMBIAR_CLAVE');
  return u;
}

function comisionesMapa() {
  var m = {};
  BD.leer(HOJAS.COMISIONES).forEach(function (c) { m[num(c.numero)] = { numero: num(c.numero), nombre: s(c.nombre), color: s(c.color) }; });
  return m;
}

function usuarioPublico(u, comis) {
  var c = comis[num(u.comision)];
  return {
    cedula: limpiarCedula(u.cedula), nombre: s(u.nombre), rol: s(u.rol).toUpperCase(),
    comision: num(u.comision), comisionNombre: c ? c.nombre : '', comisionColor: c ? c.color : '',
    lider: siNo(u.lider), empresa: s(u.empresa)
  };
}

/* ---------- tareas y avance ---------- */
function tareasActivas() {
  return BD.leer(HOJAS.TAREAS).filter(function (t) {
    return s(t.id) && s(t.activa).toUpperCase() !== 'NO';
  }).sort(function (a, b) {
    var fa = PLAT.fechaTexto(a.fecha_limite), fb = PLAT.fechaTexto(b.fecha_limite);
    if (fa !== fb) return fa < fb ? -1 : 1;
    return num(a.orden) - num(b.orden);
  });
}

function tareaAplica(t, u) {
  var tipo = s(t.tipo).toUpperCase();
  if (tipo === 'INDIVIDUAL') return true;
  if (tipo === 'COMISION' || tipo === 'COMISIÓN') return num(t.comision) > 0 && num(t.comision) === num(u.comision);
  if (tipo === 'LIDER' || tipo === 'LÍDER') return siNo(u.lider) && (!num(t.comision) || num(t.comision) === num(u.comision));
  return false;
}

function ambitoDe(t, u) {
  var tipo = s(t.tipo).toUpperCase();
  return (tipo === 'COMISION' || tipo === 'COMISIÓN') ? 'COM-' + num(u.comision) : limpiarCedula(u.cedula);
}

function mapaAvance() {
  var m = {};
  BD.leer(HOJAS.AVANCE).forEach(function (r) { m[s(r.tarea_id) + '#' + s(r.ambito)] = r; });
  return m;
}

function tareasDeUsuario(u, tareas, avance) {
  var hoy = PLAT.hoy();
  return tareas.filter(function (t) { return tareaAplica(t, u); }).map(function (t) {
    var a = avance[s(t.id) + '#' + ambitoDe(t, u)];
    var f = PLAT.fechaTexto(t.fecha_limite);
    var tipo = s(t.tipo).toUpperCase().replace('Ó', 'O').replace('Í', 'I');
    return {
      id: s(t.id), tipo: tipo, titulo: s(t.titulo), descripcion: s(t.descripcion), fecha: f,
      hecho: !!a, marcadoPor: a ? s(a.nombre) : '', fechaMarcado: a ? s(a.fecha) : '',
      vencida: !a && !!f && f < hoy
    };
  });
}

function resumen(lista) {
  var hechas = lista.filter(function (t) { return t.hecho; }).length;
  var total = lista.length;
  return {
    hechas: hechas, total: total,
    porcentaje: total ? Math.round(hechas * 100 / total) : 0,
    vencidas: lista.filter(function (t) { return t.vencida; }).length
  };
}

/* ---------- mensajes ---------- */
function ultimosMensajes() {
  var lista = BD.leer(HOJAS.MENSAJES).filter(function (m) { return !siNo(m.oculto) && s(m.texto); });
  lista = lista.slice(-120);
  return lista.map(function (m) {
    return { id: s(m.id), fecha: s(m.fecha), cedula: limpiarCedula(m.cedula), nombre: s(m.nombre), rol: s(m.rol), texto: s(m.texto), aviso: siNo(m.aviso) };
  });
}

/* ---------- tablero del equipo (docente / coordinación) ---------- */
function construirTablero() {
  var usuarios = BD.leer(HOJAS.USUARIOS);
  var comis = comisionesMapa();
  var tareas = tareasActivas();
  var avance = mapaAvance();
  var estudiantes = [];
  usuarios.forEach(function (u) {
    if (s(u.rol).toUpperCase() !== 'ESTUDIANTE' || !s(u.nombre)) return;
    var lista = tareasDeUsuario(u, tareas, avance);
    var r = resumen(lista);
    var pub = usuarioPublico(u, comis);
    pub.hechas = r.hechas; pub.total = r.total; pub.porcentaje = r.porcentaje; pub.vencidas = r.vencidas;
    pub.ultimoIngreso = s(u.ultimo_ingreso);
    pub.activo = !!s(u.clave_hash);
    pub.tareas = lista;
    estudiantes.push(pub);
  });
  var porComision = Object.keys(comis).map(function (k) {
    var c = comis[k];
    var miembros = estudiantes.filter(function (e) { return e.comision === c.numero; });
    var suma = miembros.reduce(function (a, e) { return a + e.porcentaje; }, 0);
    return {
      numero: c.numero, nombre: c.nombre, color: c.color,
      miembros: miembros.map(function (e) { return e.nombre + (e.lider ? ' (líder)' : ''); }),
      porcentaje: miembros.length ? Math.round(suma / miembros.length) : 0
    };
  }).sort(function (a, b) { return a.numero - b.numero; });
  var porTarea = tareas.map(function (t) {
    var aplican = estudiantes.filter(function (e) { return e.tareas.some(function (x) { return x.id === s(t.id); }); });
    var hechas = aplican.filter(function (e) { return e.tareas.some(function (x) { return x.id === s(t.id) && x.hecho; }); });
    return { id: s(t.id), titulo: s(t.titulo), tipo: s(t.tipo).toUpperCase(), comision: num(t.comision), fecha: PLAT.fechaTexto(t.fecha_limite), hechas: hechas.length, total: aplican.length };
  });
  var general = estudiantes.length ? Math.round(estudiantes.reduce(function (a, e) { return a + e.porcentaje; }, 0) / estudiantes.length) : 0;
  return {
    general: general,
    completos: estudiantes.filter(function (e) { return e.total && e.porcentaje === 100; }).length,
    vencidas: estudiantes.reduce(function (a, e) { return a + e.vencidas; }, 0),
    sinIngresar: estudiantes.filter(function (e) { return !e.activo; }).length,
    estudiantes: estudiantes.sort(function (a, b) { return a.comision - b.comision || a.nombre.localeCompare(b.nombre); }),
    comisiones: porComision,
    tareas: porTarea,
    hoy: PLAT.hoy()
  };
}

/* ---------- acciones ---------- */
function accionLogin(p) {
  var ced = limpiarCedula(p.cedula);
  if (!/^\d{5,12}$/.test(ced)) falla('Escribe tu número de cédula, solo números.');
  var clave = String(p.clave || '');
  var llave = 'intentos_' + ced;
  var intentos = Number(PLAT.cacheGet(llave) || 0);
  if (intentos >= MAX_INTENTOS) falla('Demasiados intentos fallidos. Espera 15 minutos o habla con el docente.');
  var u = buscarUsuario(ced);
  var ok = false;
  if (u) {
    if (!s(u.clave_hash)) ok = clave !== '' && clave === s(config().clave_inicial);
    else ok = hashClave(ced, clave) === s(u.clave_hash);
  }
  if (!ok) {
    PLAT.cachePut(llave, String(intentos + 1), 900);
    falla(u ? 'La clave no es correcta.' : 'Esa cédula no está registrada. Habla con el docente.');
  }
  PLAT.cachePut(llave, '0', 1);
  BD.actualizar(HOJAS.USUARIOS, u._fila, { ultimo_ingreso: PLAT.ahoraTexto() });
  return { token: crearToken(ced), debeCambiar: !s(u.clave_hash) || siNo(u.cambiar_clave), nombre: s(u.nombre) };
}

function accionCambiarClave(p) {
  var u = usuarioSesion(p, true);
  var nueva = String(p.nueva || '');
  if (nueva.length < 6) falla('La nueva clave debe tener al menos 6 caracteres.');
  if (nueva === s(config().clave_inicial)) falla('La nueva clave no puede ser igual a la clave inicial.');
  BD.actualizar(HOJAS.USUARIOS, u._fila, { clave_hash: hashClave(limpiarCedula(u.cedula), nueva), cambiar_clave: 'NO' });
  return { listo: true };
}

function accionDatos(p) {
  var u = usuarioSesion(p);
  var c = config();
  var comis = comisionesMapa();
  var docs = BD.leer(HOJAS.DOCUMENTOS).filter(function (d) { return s(d.titulo); })
    .sort(function (a, b) { return num(a.orden) - num(b.orden); })
    .map(function (d) { return { titulo: s(d.titulo), descripcion: s(d.descripcion), enlace: s(d.enlace), categoria: s(d.categoria) }; });
  var r = {
    usuario: usuarioPublico(u, comis),
    evento: {
      titulo: s(c.titulo_evento), subtitulo: s(c.subtitulo), fecha: PLAT.fechaTexto(c.fecha_evento),
      hora: s(c.hora_evento), lugar: s(c.lugar), video: s(c.video_url), bienvenida: s(c.bienvenida)
    },
    comisiones: Object.keys(comis).map(function (k) { return comis[k]; }),
    documentos: docs,
    mensajes: ultimosMensajes(),
    hoy: PLAT.hoy()
  };
  if (esEquipo(u)) {
    r.tablero = construirTablero();
  } else {
    var lista = tareasDeUsuario(u, tareasActivas(), mapaAvance());
    r.tareas = lista;
    r.progreso = resumen(lista);
    r.companeros = BD.leer(HOJAS.USUARIOS).filter(function (x) {
      return s(x.rol).toUpperCase() === 'ESTUDIANTE' && num(x.comision) === num(u.comision) && s(x.nombre);
    }).map(function (x) { return { nombre: s(x.nombre), lider: siNo(x.lider) }; });
  }
  return r;
}

function accionMarcar(p) {
  return PLAT.conBloqueo(function () {
    var u = usuarioSesion(p);
    if (esEquipo(u)) falla('Solo los estudiantes marcan sus responsabilidades.');
    var t = null;
    tareasActivas().forEach(function (x) { if (s(x.id) === s(p.tareaId)) t = x; });
    if (!t || !tareaAplica(t, u)) falla('Esa responsabilidad no te corresponde.');
    var amb = ambitoDe(t, u);
    var existente = null;
    BD.leer(HOJAS.AVANCE).forEach(function (r) { if (s(r.tarea_id) === s(t.id) && s(r.ambito) === amb) existente = r; });
    if (p.hecho && !existente) {
      BD.agregar(HOJAS.AVANCE, { tarea_id: s(t.id), ambito: amb, marcado_por: limpiarCedula(u.cedula), nombre: s(u.nombre), fecha: PLAT.ahoraTexto() });
    } else if (!p.hecho && existente) {
      BD.borrar(HOJAS.AVANCE, existente._fila);
    }
    var lista = tareasDeUsuario(u, tareasActivas(), mapaAvance());
    return { tareas: lista, progreso: resumen(lista) };
  });
}

function accionMensajes(p) {
  usuarioSesion(p);
  return { mensajes: ultimosMensajes() };
}

function accionPublicar(p) {
  return PLAT.conBloqueo(function () {
    var u = usuarioSesion(p);
    var texto = s(p.texto);
    if (!texto) falla('Escribe un mensaje.');
    if (texto.length > 1000) falla('El mensaje es muy largo (máximo 1000 caracteres).');
    var aviso = !!p.aviso;
    if (aviso && !esEquipo(u)) falla('Solo el docente y la coordinación pueden publicar avisos.');
    BD.agregar(HOJAS.MENSAJES, {
      id: PLAT.uuid(), fecha: PLAT.ahoraTexto(), cedula: limpiarCedula(u.cedula), nombre: s(u.nombre),
      rol: s(u.rol).toUpperCase(), texto: texto, aviso: aviso ? 'SI' : 'NO', oculto: 'NO'
    });
    return { mensajes: ultimosMensajes() };
  });
}

function accionBorrarMensaje(p) {
  return PLAT.conBloqueo(function () {
    var u = usuarioSesion(p);
    var m = null;
    BD.leer(HOJAS.MENSAJES).forEach(function (x) { if (s(x.id) === s(p.id)) m = x; });
    if (!m) falla('Ese mensaje ya no existe.');
    if (!esEquipo(u) && limpiarCedula(m.cedula) !== limpiarCedula(u.cedula)) falla('Solo puedes borrar tus propios mensajes.');
    BD.actualizar(HOJAS.MENSAJES, m._fila, { oculto: 'SI' });
    return { mensajes: ultimosMensajes() };
  });
}


/* ---------- restablecer clave (docente / dueño de la hoja) ---------- */
function claveTemporal() {
  var ab = 'abcdefghjkmnpqrstuvwxyz23456789', c = '';
  for (var i = 0; i < 6; i++) c += ab.charAt(Math.floor(Math.random() * ab.length));
  return c;
}

function restablecerClaveDe(u) {
  var ced = limpiarCedula(u.cedula), t = claveTemporal();
  BD.actualizar(HOJAS.USUARIOS, u._fila, { clave_hash: hashClave(ced, t), cambiar_clave: 'SI' });
  PLAT.cachePut('intentos_' + ced, '0', 1); // también quita el bloqueo por intentos fallidos
  return t;
}

function accionRestablecer(p) {
  return PLAT.conBloqueo(function () {
    var u = usuarioSesion(p);
    if (s(u.rol).toUpperCase() !== 'DOCENTE') falla('Solo el docente puede restablecer claves.');
    var x = buscarUsuario(limpiarCedula(p.cedula));
    if (!x) falla('Ese usuario no está registrado.');
    if (s(x.rol).toUpperCase() === 'DOCENTE') falla('Tu propia clave se restablece desde la hoja de Google (menú III Encuentro).');
    return { nombre: s(x.nombre), temporal: restablecerClaveDe(x) };
  });
}

function despachar(p) {
  p = p || {};
  switch (s(p.accion)) {
    case 'login': return accionLogin(p);
    case 'cambiarClave': return accionCambiarClave(p);
    case 'datos': return accionDatos(p);
    case 'marcar': return accionMarcar(p);
    case 'mensajes': return accionMensajes(p);
    case 'publicar': return accionPublicar(p);
    case 'borrarMensaje': return accionBorrarMensaje(p);
    case 'restablecerClave': return accionRestablecer(p);
    default: falla('Acción no reconocida.');
  }
}

function responder(p) {
  try { return { ok: true, data: despachar(p) }; }
  catch (e) { return { ok: false, error: e.mensaje || 'Ocurrió un error inesperado. Intenta de nuevo.', codigo: e.codigo || '', detalle: e.mensaje ? '' : String(e && e.message) }; }
}

/* ---------- datos iniciales (se cargan al configurar la hoja) ---------- */
function datosIniciales(demo) {
  var com = [
    [1, 'Invitaciones', '#7C3AED'], [2, 'Patrocinio', '#F59E0B'], [3, 'Logística y auditorio', '#10B981'],
    [4, 'Control de tiempos', '#EF4444'], [5, 'Refrigerio', '#EC4899'], [6, 'Comunicación y registro', '#0EA5E9']
  ];
  var est = [
    ['Karol Arenas', 1, 'SI', ''], ['María Alejandra Castro', 1, 'NO', ''], ['Camila Contreras', 1, 'NO', ''],
    ['Britney Garcés', 2, 'SI', ''], ['Jerson Galvis', 2, 'NO', ''], ['Carlos Marín', 2, 'NO', ''],
    ['Walter Rincón', 3, 'SI', ''], ['Irma Ubarne', 3, 'NO', ''], ['Paula Vesga', 3, 'NO', ''],
    ['Natalia Ochoa', 4, 'SI', ''], ['Janix Navarro', 4, 'NO', 'COSERFUN (Los Olivos)'],
    ['Katerin Hernández', 5, 'SI', ''], ['Mayreth Gutiérrez', 5, 'NO', ''], ['Tania Pérez', 5, 'NO', ''],
    ['Luisa Pianeta', 6, 'SI', ''], ['Evelyn Badillo', 6, 'NO', '']
  ];
  var usuarios = est.map(function (e, i) {
    return { cedula: demo ? String(10001 + i) : '', nombre: e[0], rol: 'ESTUDIANTE', comision: e[1], lider: e[2], empresa: e[3], clave_hash: '', cambiar_clave: 'SI', ultimo_ingreso: '' };
  });
  usuarios.push({ cedula: demo ? '20001' : '', nombre: 'Omar Guerrero Avilés', rol: 'DOCENTE', comision: '', lider: 'NO', empresa: '', clave_hash: '', cambiar_clave: 'SI', ultimo_ingreso: '' });
  usuarios.push({ cedula: demo ? '20002' : '', nombre: 'Coordinación ANI', rol: 'COORDINADOR', comision: '', lider: 'NO', empresa: '', clave_hash: '', cambiar_clave: 'SI', ultimo_ingreso: '' });

  // [id, tipo, comisión, título, descripción, fecha]
  var t = [
    ['I01', 'INDIVIDUAL', '', 'Ver el video de instrucciones', 'Mira completo el video de la portada y lee el plan de trabajo y responsabilidades.', '2026-11-07'],
    ['I02', 'INDIVIDUAL', '', 'Entregar la invitación a mi empresario', 'Entrega la invitación personalizada (impresa o por correo) a tu empresario o asesor externo.', '2026-11-09'],
    ['I03', 'INDIVIDUAL', '', 'Solicitar el certificado de práctica', 'Entrega a tu empresario la carta de solicitud del certificado de práctica. Plazo de entrega del certificado: 18 de noviembre.', '2026-11-09'],
    ['I04', 'INDIVIDUAL', '', 'Preparar diapositivas y guion de mi presentación', 'Usa el guion de presentación. Tu exposición debe mostrar el diagnóstico, el plan de trabajo y los resultados en la empresa.', '2026-11-10'],
    ['I05', 'INDIVIDUAL', '', 'Grabar mi presentación en el estudio', 'Grabación en off en el estudio de la Escuela de Ciencias Sociales y de las Comunicaciones, martes 10 de noviembre.', '2026-11-10'],
    ['I06', 'INDIVIDUAL', '', 'Participar en el primer ensayo', 'Presenta tu exposición y recibe retroalimentación.', '2026-11-11'],
    ['I07', 'INDIVIDUAL', '', 'Entregar la presentación final', 'Envía al docente la versión final ya corregida.', '2026-11-12'],
    ['I08', 'INDIVIDUAL', '', 'Confirmar la asistencia de mi empresario', 'Confirma si tu empresario asiste y avisa a la Comisión de Invitaciones.', '2026-11-13'],
    ['I09', 'INDIVIDUAL', '', 'Asistir al ensayo general', 'Ensayo general en el auditorio con tiempos reales.', '2026-11-17'],
    ['I10', 'INDIVIDUAL', '', 'Participar en el III Encuentro Empresarial', 'Llega con anticipación, con presentación personal formal, y acompaña a tu empresario.', '2026-11-18'],
    ['I11', 'INDIVIDUAL', '', 'Recibir el certificado de práctica firmado', 'Recibe el certificado firmado por tu empresario y entrégale una copia al docente.', '2026-11-18'],
    ['I12', 'INDIVIDUAL', '', 'Enviar la carta de agradecimiento a mi empresario', 'Usa el modelo de carta de agradecimiento y envíala firmada.', '2026-11-25'],
    ['L01', 'LIDER', '', 'Reunir a mi comisión y repartir tareas', 'Organiza a tu equipo y define quién hace cada tarea.', '2026-11-07'],
    ['L02', 'LIDER', '', 'Enviar el reporte de mi comisión', 'Reporta al docente el avance de la comisión y los recursos cubiertos.', '2026-11-13'],
    ['C101', 'COMISION', 1, 'Lista de empresarios e invitados con datos de contacto', 'Consolida nombre, cargo, empresa, celular y correo de cada invitado.', '2026-11-09'],
    ['C102', 'COMISION', 1, 'Verificar que todas las invitaciones se entregaron', 'Confirma con cada compañero que su empresario recibió la invitación.', '2026-11-09'],
    ['C103', 'COMISION', 1, 'Consolidar confirmaciones de asistencia', 'Entrega al docente la lista de empresarios confirmados.', '2026-11-13'],
    ['C104', 'COMISION', 1, 'Llamar a los empresarios para recordar el evento', 'Recordatorio el día anterior: fecha, hora y lugar.', '2026-11-17'],
    ['C201', 'COMISION', 2, 'Lista de posibles patrocinadores', 'Identifica empresas que puedan aportar en especie.', '2026-11-08'],
    ['C202', 'COMISION', 2, 'Entregar las cartas de solicitud de patrocinio', 'Entrega la carta de solicitud de aporte en especie a cada posible patrocinador.', '2026-11-10'],
    ['C203', 'COMISION', 2, 'Registrar los aportes recibidos', 'Anota cada aporte en el cuadro de ingresos y gastos.', '2026-11-13'],
    ['C204', 'COMISION', 2, 'Agradecer a los patrocinadores', 'Envía la carta de agradecimiento a cada patrocinador.', '2026-11-25'],
    ['C301', 'COMISION', 3, 'Verificar la reserva del auditorio y los equipos', 'Confirma con el docente el auditorio, el video beam, el sonido y los micrófonos.', '2026-11-10'],
    ['C302', 'COMISION', 3, 'Plano de ubicación del auditorio', 'Define la mesa de registro, la zona de empresarios y la de invitados.', '2026-11-13'],
    ['C303', 'COMISION', 3, 'Prueba de sonido y proyección', 'Prueba todas las presentaciones en el equipo del auditorio.', '2026-11-17'],
    ['C304', 'COMISION', 3, 'Montaje y desmontaje del auditorio', 'Organiza el auditorio antes del evento y déjalo en orden al terminar.', '2026-11-18'],
    ['C401', 'COMISION', 4, 'Cronograma minuto a minuto', 'Construye el cronograma del día a partir del guion del evento.', '2026-11-12'],
    ['C402', 'COMISION', 4, 'Carteles de tiempo', 'Prepara los carteles de 5, 2 y 0 minutos para los expositores.', '2026-11-13'],
    ['C403', 'COMISION', 4, 'Medir tiempos en el ensayo general', 'Mide cada presentación y reporta los ajustes al docente.', '2026-11-17'],
    ['C404', 'COMISION', 4, 'Controlar los tiempos el día del evento', 'Avisa a cada expositor y mantén el evento en horario.', '2026-11-18'],
    ['C501', 'COMISION', 5, 'Cotizar el refrigerio', 'Pide cotización a por lo menos dos proveedores.', '2026-11-09'],
    ['C502', 'COMISION', 5, 'Confirmar el pedido del refrigerio', 'Define la cantidad según los confirmados y confirma el pedido.', '2026-11-13'],
    ['C503', 'COMISION', 5, 'Organizar la entrega del refrigerio', 'Coordina la entrega a empresarios, invitados y estudiantes.', '2026-11-18'],
    ['C601', 'COMISION', 6, 'Planilla de registro de asistentes', 'Diseña la planilla de registro (nombre, empresa, cargo, correo, firma).', '2026-11-12'],
    ['C602', 'COMISION', 6, 'Apoyar la difusión del evento', 'Apoya a Comunicaciones UNIPAZ y las redes del programa con piezas y publicaciones.', '2026-11-13'],
    ['C603', 'COMISION', 6, 'Registro fotográfico y de asistentes', 'Toma fotos y lleva el registro de asistentes durante el evento.', '2026-11-18'],
    ['C604', 'COMISION', 6, 'Entregar fotos y planilla al docente', 'Comparte las fotos y la planilla diligenciada.', '2026-11-20']
  ];
  var tareas = t.map(function (x, i) {
    return { id: x[0], tipo: x[1], comision: x[2], titulo: x[3], descripcion: x[4], fecha_limite: x[5], orden: i + 1, activa: 'SI' };
  });

  var d = [
    ['Solicitud de certificado de práctica', 'Carta para pedir el certificado a tu empresario.', 'Cartas'],
    ['Carta de solicitud de patrocinio en especie', 'Modelo para pedir aportes a empresas.', 'Cartas'],
    ['Carta de agradecimiento al empresario', 'Para enviar después del evento.', 'Cartas'],
    ['Guion de la presentación', 'Estructura y tiempos de tu exposición.', 'Presentación'],
    ['Planilla de registro de asistentes', 'Para la mesa de registro.', 'Logística'],
    ['Cuadro de ingresos y gastos', 'Control de aportes, ventas y compras.', 'Logística']
  ];
  var docs = d.map(function (x, i) { return { orden: i + 1, titulo: x[0], descripcion: x[1], enlace: demo && i < 3 ? 'https://drive.google.com/' : '', categoria: x[2] }; });

  var conf = [
    ['titulo_evento', 'III Encuentro Empresarial', 'Nombre del evento'],
    ['subtitulo', 'Consultorio Empresarial · Administración de Negocios Internacionales · UNIPAZ', ''],
    ['fecha_evento', '2026-11-18', 'Formato AAAA-MM-DD'],
    ['hora_evento', '8:00 a. m.', ''],
    ['lugar', 'Auditorio del 4.º piso, UNIPAZ', ''],
    ['video_url', demo ? '' : '', 'Enlace de YouTube (puede ser "no listado") o de Google Drive'],
    ['bienvenida', 'Aquí tienes todo lo que necesitas para el III Encuentro Empresarial: el video con las instrucciones, los documentos y tus responsabilidades. Marca cada tarea cuando la cumplas.', 'Texto de bienvenida'],
    ['clave_inicial', demo ? 'demo123' : 'Encuentro2026', 'Clave del primer ingreso; luego cada uno crea la suya']
  ].map(function (x) { return { clave: x[0], valor: x[1], nota: x[2] }; });

  var mensajes = [{
    id: 'm0', fecha: demo ? '2026-11-06 08:00' : '', cedula: demo ? '20001' : '', nombre: 'Omar Guerrero Avilés', rol: 'DOCENTE',
    texto: 'Bienvenidos al espacio del III Encuentro Empresarial. Por aquí publicaré los avisos. Revisen sus responsabilidades y márquenlas a medida que las cumplan.',
    aviso: 'SI', oculto: 'NO'
  }];

  return {
    Config: conf,
    Usuarios: usuarios,
    Comisiones: com.map(function (c) { return { numero: c[0], nombre: c[1], color: c[2] }; }),
    Tareas: tareas,
    Avance: [],
    Mensajes: demo ? mensajes : mensajes.map(function (m) { m.fecha = ''; return m; }),
    Documentos: docs
  };
}
/* Plataforma de DEMOSTRACIÓN: guarda todo en este navegador (localStorage).
   Sirve para ver la aplicación antes de conectar la hoja de Google. */
var LLAVE_DEMO = 'encuentro_demo_v1';
var _mem = null;
var _props = {};
var _cache = {};

function _cargar() {
  if (_mem) return _mem;
  try { _mem = JSON.parse(localStorage.getItem(LLAVE_DEMO) || 'null'); } catch (e) { _mem = null; }
  if (!_mem) {
    var ini = datosIniciales(true);
    _mem = { props: {}, hojas: {} };
    Object.keys(ini).forEach(function (k) { _mem.hojas[k] = ini[k]; });
    _guardar();
  }
  _props = _mem.props;
  return _mem;
}
function _guardar() { try { localStorage.setItem(LLAVE_DEMO, JSON.stringify(_mem)); } catch (e) { } }

var BD = {
  leer: function (nombre) {
    return (_cargar().hojas[nombre] || []).map(function (o, i) {
      var c = {}; for (var k in o) c[k] = o[k]; c._fila = i + 2; return c;
    });
  },
  agregar: function (nombre, obj) { var h = _cargar().hojas[nombre]; var c = {}; for (var k in obj) c[k] = obj[k]; h.push(c); _guardar(); },
  actualizar: function (nombre, fila, cambios) { var h = _cargar().hojas[nombre]; for (var k in cambios) h[fila - 2][k] = cambios[k]; _guardar(); },
  borrar: function (nombre, fila) { _cargar().hojas[nombre].splice(fila - 2, 1); _guardar(); }
};

function _hashSimple(txt) {
  var h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (var i = 0; i < txt.length; i++) {
    var c = txt.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
}
function _partesBogota(d) {
  var f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  var o = {}; f.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
  return o;
}

var PLAT = {
  sha256: function (t) { return _hashSimple(t); },
  hmac: function (t, k) { return _hashSimple(k + '::' + t); },
  prop: function (k) { _cargar(); return _props[k] || null; },
  setProp: function (k, v) { _cargar(); _props[k] = v; _guardar(); },
  cacheGet: function (k) { var c = _cache[k]; return c && c.hasta > Date.now() ? c.v : null; },
  cachePut: function (k, v, seg) { _cache[k] = { v: v, hasta: Date.now() + seg * 1000 }; },
  ahoraMs: function () { return Date.now(); },
  hoy: function () { var p = _partesBogota(new Date()); return p.year + '-' + p.month + '-' + p.day; },
  ahoraTexto: function () { var p = _partesBogota(new Date()); return p.year + '-' + p.month + '-' + p.day + ' ' + (p.hour === '24' ? '00' : p.hour) + ':' + p.minute; },
  fechaTexto: function (v) { return v === null || v === undefined ? '' : String(v).trim(); },
  uuid: function () { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); },
  conBloqueo: function (fn) { return fn(); }
};

function reiniciarDemo() { try { localStorage.removeItem(LLAVE_DEMO); } catch (e) { } _mem = null; _cargar(); }
return { llamar: function (p) { return JSON.parse(JSON.stringify(responder(p))); }, reiniciar: reiniciarDemo };
})();
