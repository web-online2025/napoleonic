// --- 1. VARIABLES GLOBALES ---
var recursos = { oro: 200, comida: 150, madera: 250, tabaco: 150, mosquetes: 10 };
var ciudades = [];
var ciudadSeleccionadaIndex = null;
var progresoMetropolis = 0;
var seleccionJugadorIndex = null;
var enemigoActual = null;
var frenteEnemigo = [];
var contadorUnidades = 1;

// --- 2. CONFIGURACIÓN DE IMÁGENES ---
var imgData = {
    infanteria: 'pesada.jpg',
    caballeria: 'caballeria.jpg',
    canon: 'canon.jpg',
    ligera: 'ligera.jpg', 
    ciudad: 'ciudad.jpg',
    victoria: 'victoria.jpg',
    derrota: 'derrota.jpg',
    retirada: 'retirada.jpg'
};

// --- SONIDOS ---
// Asegúrate de que los archivos existen en la carpeta /sonidos/ y que el servidor los sirve correctamente
var sonidos = {
  reclutar: 'mande.mp3',      // al reclutar
  victoria: 'victoria.mp3', // victoria
  derrota: 'derrota.mp3',   // derrota
  seleccionar: 'voy.mp3', // al seleccionar carta / iniciar ataque
  combatir: 'derrota.mp3',    // usar mismo para iniciar combate (puedes cambiar)
  ciudad: 'ciudad.mp3'      // al construir una ciudad
};

// Precarga opcional (reduce latencia en algunos casos)
var audioCache = {};
function preloadSounds() {
  Object.keys(sonidos).forEach(function(k) {
    var src = sonidos[k];
    if (!src) return;
    try {
      var a = new Audio(src);
      a.preload = 'auto';
      audioCache[k] = a;
      console.log('Preloading sound:', k, src);
    } catch (e) {
      console.warn('Error precargando sonido', k, e);
    }
  });
}

// Reproducción robusta: intenta usar la precarga pero crea nuevo Audio(src) para mayor compatibilidad
function playSound(key, volume) {
  volume = (typeof volume === 'number') ? volume : 0.6;
  var src = sonidos[key];
  if (!src) {
    console.warn('playSound: key no encontrada', key);
    return;
  }
  try {
    // Crear nueva instancia siempre para evitar problemas de cloneNode/estado
    var audio = new Audio(src);
    audio.volume = volume;
    // Opcional: si ya existe en cache, intentar usar su src (misma cosa aquí)
    audio.play().catch(function(err){
      // Los navegadores pueden bloquear reproducción si no hay gesto de usuario
      console.warn('playSound fallo al reproducir', key, err);
    });
    console.log('playSound: intentando reproducir', key, src);
  } catch (e) {
    console.warn('playSound error', e);
  }
}

// Función de prueba para debug: la llamas desde consola: testSound('reclutar')
function testSound(key) {
  console.log('testSound', key, sonidos[key]);
  playSound(key, 0.8);
}

// --- 3. CATÁLOGO DE UNIDADES (DATOS MAESTROS) ---
var catalogo = {
    'Infantería Ligera': { tipo: 'Infantería Ligera', ataque: 15, vidaMax: 70, vida: 70, img: imgData.ligera },
    'Infantería Pesada': { tipo: 'Infantería Pesada', ataque: 20, vidaMax: 100, vida: 100, img: imgData.infanteria },
    'Caballería': { tipo: 'Caballería', ataque: 25, vidaMax: 120, vida: 120, img: imgData.caballeria },
    'Cañón': { tipo: 'Cañón', ataque: 45, vidaMax: 50, vida: 50, img: imgData.canon }
};

// --- 4. DATOS DE EDIFICIOS ---
var edificiosData = {
    1: [
        { nombre: "Barracas", coste: { madera: 60, oro: 20 }, desc: "Permite reclutar Infantería Ligera." },
        { nombre: "Molino", coste: { madera: 40 }, produce: { comida: 10 }, desc: "Genera +10 de Comida por turno." },
        { nombre: "Aserradero", coste: { oro: 30 }, produce: { madera: 15 }, desc: "Genera +15 de Madera por turno." }
    ],
    2: [
        { nombre: "Almacén", coste: { madera: 100 }, produce: { oro: 15 }, desc: "Aumenta impuestos: +15 Oro por turno." },
        { nombre: "Granja Tabaco", coste: { oro: 80, madera: 50 }, produce: { tabaco: 20 }, desc: "Produce Tabaco para exportar." }
    ],
    3: [
        { nombre: "Academia Militar", coste: { comida: 200, oro: 200 }, desc: "Permite reclutar Infantería Pesada y Caballería." },
        { nombre: "Armería", coste: { oro: 200, madera: 100 }, desc: "Permite la fundición de Cañones." }
    ]
};

var costesNivel = { 1: 100, 2: 250 };
var limitesGuarnicion = { 1: 2, 2: 5, 3: 10 };

// --- 5. EJÉRCITO INICIAL ---
// Función auxiliar para clonar objetos y evitar errores de referencia
function crearUnidad(tipo) {
    var proto = catalogo[tipo];
    return {
        tipo: proto.tipo,
        ataque: proto.ataque,
        vidaMax: proto.vidaMax,
        vida: proto.vidaMax,
        img: proto.img,
        peloton: contadorUnidades++,
        descansando: false
    };
}

var misCartas = [
    crearUnidad('Infantería Ligera'),
    crearUnidad('Infantería Pesada'),
    crearUnidad('Caballería')
];

// --- 6. FUNCIONES PRINCIPALES DE INTERFAZ ---
function actualizarIU() {
    // Actualizar recursos en pantalla
    for (var r in recursos) {
        var el = document.getElementById(r);
        if(el) el.innerText = recursos[r];
    }
    
    // Barra de Progreso Metrópolis
    var bar = document.getElementById('progreso-metropolis');
    if(bar) {
        bar.style.width = progresoMetropolis + "%";
        bar.innerText = progresoMetropolis + "%";
    }

    // Mostrar/Ocultar Panel de Recompensas (Sin usar símbolos raros)
    var recPanel = document.getElementById('recompensa-panel');
    if(recPanel) {
        if (progresoMetropolis >= 100) {
            recPanel.classList.remove('hidden');
        } else {
            recPanel.classList.add('hidden');
        }
    }
    
    dibujarCuartel(); 
    dibujarCiudades(); 
    dibujarFrenteEnemigo();
}

// --- 7. GESTIÓN DE CIUDAD Y RECLUTAMIENTO ---

// Esta función debe ser global para que el HTML la encuentre
function abrirGestionCiudad(i) {
    ciudadSeleccionadaIndex = i;
    var modal = document.getElementById('modal-ciudad');
    if (modal) {
        modal.classList.remove('hidden');
        actualizarPanelCiudad();
    } else {
        console.error("No se encuentra el modal-ciudad en el HTML");
    }
}

function cerrarModalCiudad() {
    var modal = document.getElementById('modal-ciudad');
    if (modal) modal.classList.add('hidden');
}

function actualizarPanelCiudad() {
    if (ciudadSeleccionadaIndex === null) return;
    
    var ciudad = ciudades[ciudadSeleccionadaIndex];
    var limiteActual = limitesGuarnicion[ciudad.nivel];
    
    var nombreEl = document.getElementById('ciudad-nombre');
    if(nombreEl) nombreEl.innerText = "Colonia #" + ciudad.id;
    
    var statsEl = document.getElementById('ciudad-stats');
    if(statsEl) statsEl.innerHTML = "Nivel " + ciudad.nivel + " | Capacidad: <b>" + ciudad.unidadesProducidas + "/" + limiteActual + "</b>";

    var zonaRec = document.getElementById('reclutamiento-zona'); 
    if(zonaRec) {
        zonaRec.innerHTML = '';
        var puede = ciudad.unidadesProducidas < limiteActual;

        // Verificar edificios para habilitar reclutamiento
        var tieneBarracas = false;
        var tieneAcademia = false;
        var tieneArmeria = false;

        for(var k=0; k<ciudad.edificios.length; k++) {
            if(ciudad.edificios[k].nombre === "Barracas") tieneBarracas = true;
            if(ciudad.edificios[k].nombre === "Academia Militar") tieneAcademia = true;
            if(ciudad.edificios[k].nombre === "Armería") tieneArmeria = true;
        }

        if (tieneBarracas) {
            crearBotonRecluta(zonaRec, 'Infantería Ligera', {oro:20, comida:20, mosquetes:10}, puede);
        }
        if (tieneAcademia) {
            crearBotonRecluta(zonaRec, 'Infantería Pesada', {oro:40, comida:30, mosquetes:20}, puede);
            crearBotonRecluta(zonaRec, 'Caballería', {oro:60, comida:40, mosquetes:15}, puede);
        }
        if (tieneArmeria) {
            crearBotonRecluta(zonaRec, 'Cañón', {oro:80, madera:100, mosquetes:5}, puede);
        }
    }

    var listaEd = document.getElementById('lista-edificios'); 
    if(listaEd) {
        listaEd.innerHTML = '';
        var comprados = 0;
        var edificiosDisponibles = edificiosData[ciudad.nivel];

        edificiosDisponibles.forEach(function(ed) {
            // Verificar si ya tenemos este edificio
            var existe = false;
            for(var m=0; m<ciudad.edificios.length; m++) {
                if(ciudad.edificios[m].nombre === ed.nombre) { existe = true; break; }
            }
            
            if (existe) comprados++;

            var div = document.createElement('div'); 
            div.className = "unidad-card-item"; 
            div.style.minHeight = "160px";

            // Construir texto de coste manual para evitar errores
            var textoCostos = "";
            if(ed.coste && ed.coste.oro) textoCostos += ed.coste.oro + " Oro ";
            if(ed.coste && ed.coste.madera) textoCostos += ed.coste.madera + " Madera ";
            if(ed.coste && ed.coste.comida) textoCostos += ed.coste.comida + " Comida ";

            div.innerHTML = '<b style="color:#003366;">' + ed.nombre + '</b>' +
                            '<p style="font-size:0.7rem; margin:5px 0;">' + ed.desc + '</p>' +
                            '<small>Coste: ' + textoCostos + '</small>';

            var btn = document.createElement('button'); 
            btn.className = "btn-classic"; 
            btn.style.width = "100%";

            if (existe) { 
                btn.innerText = "Comprado"; 
                btn.disabled = true; 
                btn.style.background = "#28a745"; // VERDE
                btn.style.color = "white"; 
            } else { 
                btn.innerText = "Construir"; 
                btn.onclick = function() { comprarEdificio(ed); }; 
            }
            div.appendChild(btn); 
            listaEd.appendChild(div);
        });

        // Botón de subir nivel
        var btnNivel = document.getElementById('btn-subir-nivel');
        if (btnNivel) {
            if (ciudad.nivel < 3) {
                var listo = (comprados === edificiosDisponibles.length);
                btnNivel.disabled = !listo;
                btnNivel.innerText = listo ? "Mejorar Ciudad (" + costesNivel[ciudad.nivel] + " Oro)" : "🔒 Construye todo primero";
                btnNivel.onclick = function() { 
                    if(recursos.oro >= costesNivel[ciudad.nivel]){ 
                        recursos.oro -= costesNivel[ciudad.nivel]; 
                        ciudad.nivel++; 
                        actualizarPanelCiudad(); 
                        actualizarIU(); 
                    } 
                };
            } else {
                btnNivel.innerText = "Nivel Máximo Alcanzado"; 
                btnNivel.disabled = true;
            }
        }
    }
}

function crearBotonRecluta(cont, tipo, cost, puede) {
    var unit = catalogo[tipo];
    var div = document.createElement('div'); 
    div.className = "unidad-card-item";
    
    // Construir string de costos
    var costStr = "";
    if(cost.oro) costStr += cost.oro + " Oro ";
    if(cost.comida) costStr += cost.comida + " Comida ";
    if(cost.mosquetes) costStr += cost.mosquetes + " Mosquetes ";
    if(cost.madera) costStr += cost.madera + " Madera ";

    div.innerHTML = '<b>' + tipo + '</b><br>' +
        '<span style="color:#d9534f;">❤️Vida: ' + unit.vidaMax + '</span> | ' +
        '<span style="color:#f0ad4e;">⚔️Atq: ' + unit.ataque + '</span><br>' +
        '<small>Requiere: ' + costStr + '</small><br>' +
        '<small>Asignará Pelotón #' + contadorUnidades + '</small>';

    var btn = document.createElement('button'); 
    btn.className = "btn-classic"; 
    btn.innerText = puede ? "Reclutar" : "LÍMITE";
    btn.disabled = !puede;
    
    btn.onclick = function() {
        // Reproducir sonido de reclutamiento (gesto de usuario)
        playSound('reclutar', 0.7);

        // Verificar recursos
        for (var r in cost) { 
            if (recursos[r] < cost[r]) {
                alert("Te falta " + r);
                return; 
            }
        }
        // Descontar
        for (var r in cost) { recursos[r] -= cost[r]; }
        
        ciudades[ciudadSeleccionadaIndex].unidadesProducidas++;
        misCartas.push(crearUnidad(tipo));
        actualizarPanelCiudad(); 
        actualizarIU();
    };
    div.appendChild(btn); 
    cont.appendChild(div);
}

function comprarEdificio(ed) {
    if (!ed || !ed.coste) return;
    for (var r in ed.coste) { 
        if (recursos[r] < ed.coste[r]) {
            alert("No tienes suficiente " + r);
            return; 
        } 
    }
    for (var r in ed.coste) { recursos[r] -= ed.coste[r]; }
    
    // Clonar el edificio para guardarlo en la ciudad
    ciudades[ciudadSeleccionadaIndex].edificios.push({
        nombre: ed.nombre,
        produce: ed.produce
    });
    actualizarPanelCiudad(); 
    actualizarIU();
}

function intentarConstruirCiudad() {
    if (recursos.oro >= 50 && recursos.madera >= 100) {
        recursos.oro -= 50; 
        recursos.madera -= 100;
        ciudades.push({ id: ciudades.length+1, nivel: 1, edificios: [], unidadesProducidas: 0 });
        // Reproducir sonido de ciudad al construir
        playSound('ciudad', 0.9);
        actualizarIU();
    } else {
        alert("Necesitas 50 Oro y 100 Madera para fundar una colonia.");
    }
}

// --- 8. COMBATE ---

function iniciarCombate() {
    if (seleccionJugadorIndex === null || enemigoActual === null) return;
    
    // Sonido de combate (usar mismo audio de selección)
    playSound('combatir', 0.7);

    var tu = misCartas[seleccionJugadorIndex];
    tu.vida -= enemigoActual.ataque; 
    enemigoActual.vida -= tu.ataque;
    
    var hpJ = document.getElementById('hp-j');
    var hpE = document.getElementById('hp-e');
    if(hpJ) hpJ.innerText = (tu.vida > 0 ? tu.vida : 0);
    if(hpE) hpE.innerText = (enemigoActual.vida > 0 ? enemigoActual.vida : 0);

    if (tu.vida <= 0) {
        if (enemigoActual.vida > 0) frenteEnemigo.push(enemigoActual); // Devolver enemigo si vive
        misCartas.splice(seleccionJugadorIndex, 1);
        mostrarResultado("DERROTA", imgData.derrota, "Tu unidad ha caído en combate.");
        resetCombate();
    } else if (enemigoActual.vida <= 0) {
        recursos.oro += 20; 
        mostrarResultado("VICTORIA", imgData.victoria, "Enemigo eliminado. Botín: 20 Oro.");
        resetCombate();
    }
    actualizarIU();
}

function seleccionarCarta(i) {
    if (misCartas[i].descansando) return;
    seleccionJugadorIndex = i;
    var u = misCartas[i];

    // Sonido al seleccionar carta para atacar
    playSound('seleccionar', 0.6);
    
    var slot = document.getElementById('slot-jugador');
    if(slot) {
        slot.innerHTML = '<img src="' + u.img + '" class="card-img"><br>' +
            '<b>Pelotón #' + u.peloton + ' - ' + u.tipo + '</b><br>' +
            '<span style="color:#d9534f;">❤️HP: <span id="hp-j">' + u.vida + '</span></span><br>' +
            '⚔️Atq: ' + u.ataque;
    }
    validarCombate();
}

function seleccionarEnemigoNuevo(t) {
    // Clonar enemigo
    var proto = catalogo[t];
    enemigoActual = { 
        tipo: proto.tipo, 
        ataque: proto.ataque, 
        vida: proto.vidaMax, 
        vidaMax: proto.vidaMax, 
        img: proto.img 
    };
    
    var slot = document.getElementById('slot-enemigo');
    if(slot) {
        slot.innerHTML = '<img src="' + enemigoActual.img + '" class="card-img" style="filter:grayscale(1)"><br>' +
            '<b>' + t + '</b><br>' +
            '<span style="color:#d9534f;">❤️HP: <span id="hp-e">' + enemigoActual.vida + '</span></span><br>' +
            '⚔️Atq: ' + enemigoActual.ataque;
    }
    validarCombate();
}

function validarCombate() {
    var ok = (seleccionJugadorIndex !== null && enemigoActual !== null);
    var btnAtq = document.getElementById('btn-enfrentar');
    var btnRet = document.getElementById('btn-retirada');
    if(btnAtq) btnAtq.disabled = !ok;
    if(btnRet) btnRet.style.display = ok ? 'block' : 'none';
}

function resetCombate() { 
    seleccionJugadorIndex = null; 
    enemigoActual = null; 
    var sJ = document.getElementById('slot-jugador');
    var sE = document.getElementById('slot-enemigo');
    if(sJ) sJ.innerText = "Tu Unidad"; 
    if(sE) sE.innerText = "Enemigo"; 
    validarCombate(); 
}

function dibujarFrenteEnemigo() {
    var cont = document.getElementById('frente-enemigo');
    if(!cont) return;
    cont.innerHTML = '';
    
    frenteEnemigo.forEach(function(e, i) {
        var div = document.createElement('div'); 
        div.className = "unidad-card-item"; 
        div.style.border = "1px solid red";
        div.innerHTML = '<img src="' + e.img + '" class="card-img" style="filter:grayscale(1)">' +
                        '<b>' + e.tipo + '</b><br>' +
                        '<small>❤️' + e.vida + ' | ⚔️' + e.ataque + '</small>';
        
        var btn = document.createElement('button'); 
        btn.className = "btn-classic"; 
        btn.innerText = "Atacar";
        btn.onclick = function() {
            enemigoActual = frenteEnemigo.splice(i, 1)[0];
            
            var slot = document.getElementById('slot-enemigo');
            slot.innerHTML = '<img src="' + enemigoActual.img + '" class="card-img" style="filter:grayscale(1)"><br>' +
                '<b>' + enemigoActual.tipo + '</b><br>' +
                '<span style="color:#d9534f;">❤️HP: <span id="hp-e">' + enemigoActual.vida + '</span></span><br>' +
                '⚔️Atq: ' + enemigoActual.ataque;
            
            validarCombate(); 
            actualizarIU();
        };
        div.appendChild(btn); 
        cont.appendChild(div);
    });
}

// --- 9. SISTEMA DE ENVÍOS ---

function enviarRecurso(t) {
    if (recursos[t] >= 10 && progresoMetropolis < 100) {
        recursos[t] -= 10;
        progresoMetropolis += (t === 'tabaco' ? 20 : 10);
        if (progresoMetropolis > 100) progresoMetropolis = 100;
        actualizarIU();
    } else {
        if(progresoMetropolis >= 100) alert("La Metrópolis ya está lista.");
        else alert("Faltan recursos para el envío (Mínimo 10).");
    }
}

function pedirRefuerzo(o) {
    if (progresoMetropolis < 100) return;
    if (o === 'mosquetes') recursos.mosquetes += 30;
    else if (o === 'oro') recursos.oro += 100;
    else misCartas.push(crearUnidad(o));
    
    progresoMetropolis = 0; 
    actualizarIU();
}

function siguienteTurno() {
    ciudades.forEach(function(c) {
        recursos.oro += 5;
        c.edificios.forEach(function(e) { 
            if(e.produce) {
                for(var r in e.produce) recursos[r] += e.produce[r]; 
            }
        });
    });
    
    misCartas.forEach(function(c) {
        if (c.descansando && c.vida < c.vidaMax) {
            c.vida += 2; 
            if (c.vida >= c.vidaMax) { 
                c.vida = c.vidaMax; 
                c.descansando = false; 
            }
        }
    });
    actualizarIU();
}

// --- 10. FUNCIONES AUXILIARES DE UI ---

function dibujarCuartel() {
    var cont = document.getElementById('cuadro-ejercito'); 
    if(!cont) return;
    cont.innerHTML = '';
    
    misCartas.forEach(function(c, i) {
        var rc = c.descansando ? 'resting' : '';
        var div = document.createElement('div');
        div.className = "unidad-card-item " + rc;
        div.onclick = function() { seleccionarCarta(i); };
        
        div.innerHTML = '<img src="' + c.img + '" class="card-img">' +
                        '<b>Pelotón #' + c.peloton + ' - ' + c.tipo + '</b><br>' +
                        '<small>❤️' + c.vida + '/' + c.vidaMax + ' | ⚔️' + c.ataque + '</small>';
        
        var btn = document.createElement('button');
        btn.className = "btn-classic";
        btn.innerText = c.descansando ? '☀️' : '💤';
        btn.onclick = function(e) { 
            e.stopPropagation(); 
            toggleDescanso(i); 
        };
        
        div.appendChild(btn);
        cont.appendChild(div);
    });
}

function toggleDescanso(i) { 
    misCartas[i].descansando = !misCartas[i].descansando; 
    // Si quieres sonido al descansar, añade playSound('descansar') y define archivo
    actualizarIU(); 
}

function dibujarCiudades() {
    var cont = document.getElementById('lista-ciudades'); 
    if(!cont) return;
    cont.innerHTML = '';
    
    ciudades.forEach(function(c, i) {
        var div = document.createElement('div');
        div.className = "unidad-card-item";
        div.style.height = "140px";
        
        div.innerHTML = '<img src="' + imgData.ciudad + '" class="card-img" style="height:50px; object-fit:cover;">' +
                        '<b>Colonia #' + c.id + '</b><br>';
        
        var btn = document.createElement('button');
        btn.className = "btn-classic";
        btn.innerText = "Gestionar";
        // Aquí conectamos el botón con la función global
        btn.onclick = function() { abrirGestionCiudad(i); };
        
        div.appendChild(btn);
        cont.appendChild(div);
    });
}

function mostrarResultado(t, i, d) { 
    try {
      if (t === "VICTORIA") playSound('victoria', 0.8);
      else if (t === "DERROTA") playSound('derrota', 0.8);
    } catch (e) { console.warn('Error reproduciendo sonido resultado', e); }

    var elTitulo = document.getElementById('res-titulo');
    var elImg = document.getElementById('res-img');
    var elDet = document.getElementById('res-detalle');
    var modal = document.getElementById('modal-resultado');

    if (elTitulo) elTitulo.innerText = t;
    if (elImg) elImg.src = i;
    if (elDet) elDet.innerText = d;
    if (modal) modal.classList.remove('hidden');
}

function cerrarModal() { document.getElementById('modal-resultado').classList.add('hidden'); }
function retirarse() { 
    if (enemigoActual && enemigoActual.vida > 0) frenteEnemigo.push(enemigoActual); 
    mostrarResultado("RETIRADA", imgData.retirada, "Has ordenado la retirada."); 
    resetCombate(); 
    actualizarIU(); 
}

// --- INICIO ---
// Precargar sonidos y actualizar UI
preloadSounds();
actualizarIU();
