// --- VARIABLES DE ESTADO Y RECURSOS ---
let recursos = { oro: 100, comida: 50, madera: 150, tabaco: 0 };
let ciudades = [];
let progresoMetropolis = 0;
let seleccionJugadorIndex = null;
let enemigoActual = null;
let frenteEnemigo = [];

// --- RUTAS DE IMÁGENES (Asegúrate de que los nombres coincidan con tus archivos) ---
const imgData = {
    infanteria: 'Gemini_Generated_Image_i7ixlai7ixlai7ix-removebg-preview.png',
    caballeria: 'Gemini_Generated_Image_150wk9150wk9150w-removebg-preview.png',
    canon: 'Louis XIV Cannon From 18th Century, Alexander Dimitrov.jpg',
    victoria: 'Guardia Imperiale Granatieri a piedi 1815….jpg',
    derrota: 'descarga (70).jpg',
    retirada: 'Operaciones en Nueva York 1776 - Arre caballo!.jpg'
};

// --- CATÁLOGO DE UNIDADES ---
const catalogo = {
    'Infantería Pesada': { tipo: 'Infantería Pesada', ataque: 20, vida: 100, img: imgData.infanteria },
    'Caballería': { tipo: 'Caballería', ataque: 25, vida: 120, img: imgData.caballeria },
    'Cañón': { tipo: 'Cañón', ataque: 55, vida: 50, img: imgData.canon }
};

// Tu regimiento inicial
let misCartas = [{ ...catalogo['Infantería Pesada'] }, { ...catalogo['Caballería'] }];

// --- LÓGICA DE INTERFAZ PRINCIPAL ---
function actualizarIU() {
    // Actualizar números de recursos
    for (let key in recursos) { 
        document.getElementById(key).innerText = recursos[key]; 
    }
    
    // Barra de envío
    document.getElementById('progreso-metropolis').style.width = progresoMetropolis + "%";
    document.getElementById('progreso-metropolis').innerText = progresoMetropolis + "%";
    
    // Mostrar/Ocultar panel de recompensas
    const panel = document.getElementById('recompensa-panel');
    if (progresoMetropolis >= 100) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
    
    dibujarCuartel();
    dibujarCiudades();
    dibujarFrenteEnemigo();
}

// --- GESTIÓN DE CIUDADES ---
function intentarConstruirCiudad() {
    let falta = [];
    if (recursos.oro < 50) falta.push("Oro (50)");
    if (recursos.madera < 100) falta.push("Madera (100)");

    if (falta.length > 0) {
        alert("Recursos insuficientes: falta " + falta.join(" y "));
        return;
    }
    recursos.oro -= 50; 
    recursos.madera -= 100;
    
    // La ciudad inicia produciendo oro por defecto
    ciudades.push({ id: ciudades.length + 1, produce: 'oro' });
    actualizarIU();
}

function dibujarCiudades() {
    const cont = document.getElementById('lista-ciudades');
    cont.innerHTML = '';
    ciudades.forEach((c, i) => {
        cont.innerHTML += `
        <div class="unidad-card-item">
            🏘️ Ciudad #${c.id}<br>
            <select onchange="actualizarProduccionCiudad(${i}, this.value)">
                <option value="oro" ${c.produce === 'oro' ? 'selected' : ''}>Oro</option>
                <option value="comida" ${c.produce === 'comida' ? 'selected' : ''}>Comida</option>
                <option value="madera" ${c.produce === 'madera' ? 'selected' : ''}>Madera</option>
                <option value="tabaco" ${c.produce === 'tabaco' ? 'selected' : ''}>Tabaco</option>
            </select>
        </div>`;
    });
}

function actualizarProduccionCiudad(index, valor) {
    ciudades[index].produce = valor;
}

function siguienteTurno() {
    ciudades.forEach(c => {
        if (c.produce === 'oro') recursos.oro += 25;
        else if (c.produce === 'comida') recursos.comida += 20;
        else if (c.produce === 'madera') recursos.madera += 30;
        else if (c.produce === 'tabaco') recursos.tabaco += 15;
    });
    actualizarIU();
}

// --- PUERTO Y ENVÍOS ---
function enviarRecurso(tipo) {
    if (recursos[tipo] >= 10 && progresoMetropolis < 100) {
        recursos[tipo] -= 10;
        progresoMetropolis += (tipo === 'tabaco') ? 20 : 10;
        if (progresoMetropolis > 100) progresoMetropolis = 100;
        actualizarIU();
    }
}

function pedirRefuerzo(tipo) {
    misCartas.push({ ...catalogo[tipo] });
    progresoMetropolis = 0;
    actualizarIU();
}

// --- SISTEMA DE COMBATE Y FRENTE ---
function dibujarCuartel() {
    const cont = document.getElementById('cuadro-ejercito');
    cont.innerHTML = '';
    misCartas.forEach((c, i) => {
        cont.innerHTML += `
        <div class="unidad-card-item" onclick="seleccionarCarta(${i})">
            <img src="${c.img}" class="card-img">
            <div class="card-info">
                <b>${c.tipo}</b><br>
                <span class="stat-hp">❤️ ${c.vida}</span> | ⚔️ ${c.ataque}
            </div>
        </div>`;
    });
}

function dibujarFrenteEnemigo() {
    const cont = document.getElementById('frente-enemigo');
    cont.innerHTML = frenteEnemigo.length === 0 ? '<p style="font-size:0.75rem; color:grey; width:100%; text-align:center;">Frente despejado.</p>' : '';
    frenteEnemigo.forEach((e, i) => {
        cont.innerHTML += `
        <div class="unidad-card-item card-enemiga" style="border-color:var(--rojo)">
            <button class="btn-eliminar" onclick="eliminarDelFrente(${i})">X</button>
            <img src="${e.img}" class="card-img" style="filter:grayscale(0.5)">
            <div class="card-info"><b>${e.tipo}</b><br><span class="stat-hp">❤️ ${e.vida}</span></div>
            <button class="btn-reselect" onclick="seleccionarEnemigoFrente(${i})">Fijar Blanco</button>
        </div>`;
    });
}

function seleccionarCarta(i) {
    seleccionJugadorIndex = i;
    const c = misCartas[i];
    document.getElementById('slot-jugador').innerHTML = `
        <img src="${c.img}" style="width:60px">
        <div><b>${c.tipo}</b><br><span class="hp-restante">❤️ ${c.vida}</span></div>`;
    validar();
}

function seleccionarEnemigoNuevo(t) {
    enemigoActual = { ...catalogo[t] };
    document.getElementById('slot-enemigo').innerHTML = `
        <img src="${enemigoActual.img}" style="width:60px; filter:grayscale(1)">
        <div><b>${enemigoActual.tipo}</b><br><span class="hp-restante">❤️ ${enemigoActual.vida}</span></div>`;
    validar();
}

function seleccionarEnemigoFrente(i) {
    enemigoActual = frenteEnemigo[i];
    frenteEnemigo.splice(i, 1);
    document.getElementById('slot-enemigo').innerHTML = `
        <img src="${enemigoActual.img}" style="width:60px; filter:grayscale(0.5)">
        <div><b>${enemigoActual.tipo}</b><br><span class="hp-restante">❤️ ${enemigoActual.vida}</span></div>`;
    validar();
    dibujarFrenteEnemigo();
}

function eliminarDelFrente(i) {
    frenteEnemigo.splice(i, 1);
    dibujarFrenteEnemigo();
}

function iniciarCombate() {
    let tu = misCartas[seleccionJugadorIndex];
    let dañoTotalTu = tu.ataque;

    // BONO DE DAÑO: Cañón contra Infantería
    if (tu.tipo === 'Cañón' && enemigoActual.tipo === 'Infantería Pesada') {
        dañoTotalTu = 75;
    }

    tu.vida -= enemigoActual.ataque;
    enemigoActual.vida -= dañoTotalTu;

    // Actualizar visualmente la vida en los slots antes de los resultados
    document.getElementById('slot-jugador').querySelector('.hp-restante').innerText = "❤️ " + (tu.vida > 0 ? tu.vida : 0);
    document.getElementById('slot-enemigo').querySelector('.hp-restante').innerText = "❤️ " + (enemigoActual.vida > 0 ? enemigoActual.vida : 0);

    let t="", d="", img="";
    if (tu.vida <= 0) {
        misCartas.splice(seleccionJugadorIndex, 1);
        t = "¡DERROTA!"; d = "Regimiento destruido."; img = imgData.derrota;
    } 
    
    if (enemigoActual.vida <= 0) {
        t = "¡VICTORIA!"; d = "Enemigo eliminado."; img = imgData.victoria;
        recursos.oro += 20;
    } else {
        frenteEnemigo.push({...enemigoActual});
        if (t !== "¡DERROTA!") {
            t = "RETIRADA"; d = "El enemigo resiste y se ha posicionado en el frente."; img = imgData.retirada;
        }
    }

    setTimeout(() => {
        document.getElementById('res-titulo').innerText = t;
        document.getElementById('res-detalle').innerText = d;
        document.getElementById('res-img').src = img;
        document.getElementById('modal-resultado').classList.remove('hidden');
        resetSeleccion();
    }, 500);
}

function resetSeleccion() {
    seleccionJugadorIndex = null; 
    enemigoActual = null;
    document.getElementById('slot-jugador').innerHTML = "Tu Unidad";
    document.getElementById('slot-enemigo').innerHTML = "Enemigo";
    validar(); 
    actualizarIU();
}

function cerrarModal() { 
    document.getElementById('modal-resultado').classList.add('hidden'); 
}

function validar() { 
    document.getElementById('btn-enfrentar').disabled = !(seleccionJugadorIndex !== null && enemigoActual); 
}

// INICIO DEL JUEGO
actualizarIU();