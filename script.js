const canvas = document.getElementById('tactical-board');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// Estado global
let state = {
    isVertical: false,
    players: [],
    ball: null,
    lines: [],
    currentLine: null,
    mode: 'drag', // drag, draw, erase, pass, shoot
    isDragging: false,
    draggedItem: null,
    recording: false,
    playing: false,
    recordedFrames: [],
    frameIndex: 0,
    actionStep: 0, // Para passos do passe (0, 1)
    actionData: {}
};

// Configurações do Campo
const FIELD_COLOR = '#4CAF50';
const LINE_COLOR = 'rgba(255, 255, 255, 0.8)';
const PLAYER_RADIUS = 15;
const BALL_RADIUS = 8;

// Redimensionar e ajustar canvas
function resizeCanvas() {
    const margin = 40;
    const cw = container.clientWidth - margin * 2;
    const ch = container.clientHeight - margin * 2;
    
    // Proporção de campo de futebol (aprox 105x68)
    const ratio = state.isVertical ? 68/105 : 105/68;
    
    let w = cw;
    let h = cw / ratio;
    
    if (h > ch) {
        h = ch;
        w = h * ratio;
    }
    
    canvas.width = w;
    canvas.height = h;
    render();
}
window.addEventListener('resize', resizeCanvas);

// --- DESENHO DO CAMPO ---
function drawField() {
    const w = canvas.width;
    const h = canvas.height;
    
    // Gramado
    ctx.fillStyle = FIELD_COLOR;
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;
    
    // Linhas externas
    ctx.strokeRect(10, 10, w - 20, h - 20);
    
    ctx.beginPath();
    if (!state.isVertical) {
        // Meio campo
        ctx.moveTo(w/2, 10);
        ctx.lineTo(w/2, h-10);
        // Círculo central
        ctx.arc(w/2, h/2, h/6, 0, Math.PI * 2);
        
        // Área Esquerda
        ctx.strokeRect(10, h/2 - h/4, w/6, h/2);
        ctx.strokeRect(10, h/2 - h/8, w/12, h/4);
        
        // Área Direita
        ctx.strokeRect(w - 10 - w/6, h/2 - h/4, w/6, h/2);
        ctx.strokeRect(w - 10 - w/12, h/2 - h/8, w/12, h/4);
        
        // Gols (marcas fora do campo principal)
        ctx.strokeRect(0, h/2 - h/12, 10, h/6);
        ctx.strokeRect(w-10, h/2 - h/12, 10, h/6);
    } else {
        // Meio campo
        ctx.moveTo(10, h/2);
        ctx.lineTo(w-10, h/2);
        // Círculo central
        ctx.arc(w/2, h/2, w/6, 0, Math.PI * 2);
        
        // Área Cima
        ctx.strokeRect(w/2 - w/4, 10, w/2, h/6);
        ctx.strokeRect(w/2 - w/8, 10, w/4, h/12);
        
        // Área Baixo
        ctx.strokeRect(w/2 - w/4, h - 10 - h/6, w/2, h/6);
        ctx.strokeRect(w/2 - w/8, h - 10 - h/12, w/4, h/12);
        
        // Gols
        ctx.strokeRect(w/2 - w/12, 0, w/6, 10);
        ctx.strokeRect(w/2 - w/12, h-10, w/6, 10);
    }
    ctx.stroke();
}

function drawPlayersAndBall() {
    // Jogadores
    state.players.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = p.team === 'A' ? '#1976D2' : '#C62828';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Destaque se estiver selecionado no modo passe/chute
        if (state.actionData.selectedPlayer === p) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFEB3B';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });
    
    // Bola
    if (state.ball) {
        ctx.beginPath();
        ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#F57F17';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawLines() {
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const allLines = [...state.lines];
    if (state.currentLine) allLines.push(state.currentLine);
    
    allLines.forEach(line => {
        if (line.points.length < 2) return;
        ctx.strokeStyle = line.color;
        ctx.beginPath();
        ctx.moveTo(line.points[0].x, line.points[0].y);
        for(let i=1; i<line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
        }
        ctx.stroke();
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawField();
    drawLines();
    drawPlayersAndBall();
}

// --- INTERAÇÕES MOUSE ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function getHoveredItem(pos) {
    if (state.ball) {
        const dx = pos.x - state.ball.x;
        const dy = pos.y - state.ball.y;
        if (Math.sqrt(dx*dx + dy*dy) <= BALL_RADIUS + 5) return { type: 'ball', item: state.ball };
    }
    
    // Checar jogadores de trás pra frente (topo visual)
    for (let i = state.players.length - 1; i >= 0; i--) {
        const p = state.players[i];
        const dx = pos.x - p.x;
        const dy = pos.y - p.y;
        if (Math.sqrt(dx*dx + dy*dy) <= PLAYER_RADIUS + 2) return { type: 'player', item: p };
    }
    return null;
}

canvas.addEventListener('mousedown', (e) => {
    if (state.playing) return;
    
    const pos = getMousePos(e);
    
    if (state.mode === 'drag') {
        const hovered = getHoveredItem(pos);
        if (hovered) {
            state.isDragging = true;
            state.draggedItem = hovered.item;
        }
    } else if (state.mode === 'draw') {
        state.currentLine = { color: '#FFFF00', points: [pos] };
    } else if (state.mode === 'erase') {
        // Apaga a linha inteira se clicar perto
        state.lines = state.lines.filter(line => {
            return !line.points.some(p => {
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                return Math.sqrt(dx*dx + dy*dy) < 15;
            });
        });
        render();
    } else if (state.mode === 'pass') {
        const hovered = getHoveredItem(pos);
        if (hovered && hovered.type === 'player') {
            if (state.actionStep === 0) {
                state.actionData.selectedPlayer = hovered.item;
                state.actionStep = 1;
                document.getElementById('hint-pass').innerText = "Agora clique no receptor do passe.";
                
                // Mover bola instantaneamente pro emissor
                if(!state.ball) state.ball = {x: 0, y:0};
                state.ball.x = hovered.item.x;
                state.ball.y = hovered.item.y;
            } else {
                // Animar passe
                animateBall(hovered.item.x, hovered.item.y);
                resetSpecialMode();
            }
            render();
        }
    } else if (state.mode === 'shoot') {
        const hovered = getHoveredItem(pos);
        if (hovered && hovered.type === 'player') {
            // Mover bola pro jogador
            if(!state.ball) state.ball = {x: 0, y:0};
            state.ball.x = hovered.item.x;
            state.ball.y = hovered.item.y;
            
            // Definir alvo do gol
            let goalX, goalY;
            if (!state.isVertical) {
                // Gol direita
                goalX = canvas.width - 5;
                goalY = canvas.height / 2;
            } else {
                // Gol cima
                goalX = canvas.width / 2;
                goalY = 5;
            }
            
            animateBall(goalX, goalY);
            resetSpecialMode();
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (state.playing) return;
    const pos = getMousePos(e);
    
    if (state.isDragging && state.draggedItem) {
        state.draggedItem.x = pos.x;
        state.draggedItem.y = pos.y;
        render();
        recordFrame();
    } else if (state.mode === 'draw' && state.currentLine) {
        state.currentLine.points.push(pos);
        render();
    } else if (state.mode === 'erase' && e.buttons === 1) { // Apagar arrastando
         state.lines = state.lines.filter(line => {
            return !line.points.some(p => {
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                return Math.sqrt(dx*dx + dy*dy) < 15;
            });
        });
        render();
    }
});

canvas.addEventListener('mouseup', () => {
    if (state.isDragging) {
        state.isDragging = false;
        state.draggedItem = null;
    }
    if (state.mode === 'draw' && state.currentLine) {
        state.lines.push(state.currentLine);
        state.currentLine = null;
        render();
    }
});

canvas.addEventListener('mouseleave', () => {
    state.isDragging = false;
    state.draggedItem = null;
    if (state.mode === 'draw' && state.currentLine) {
        state.lines.push(state.currentLine);
        state.currentLine = null;
    }
});

// --- ANIMAÇÃO BOLA (Passe / Chute) ---
function animateBall(targetX, targetY) {
    if (!state.ball) return;
    const speed = 10;
    
    function step() {
        if (!state.ball || state.playing) return;
        const dx = targetX - state.ball.x;
        const dy = targetY - state.ball.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > speed) {
            state.ball.x += (dx / dist) * speed;
            state.ball.y += (dy / dist) * speed;
            render();
            recordFrame();
            requestAnimationFrame(step);
        } else {
            state.ball.x = targetX;
            state.ball.y = targetY;
            render();
            recordFrame();
        }
    }
    step();
}

// --- GRAVAÇÃO ---
function recordFrame() {
    if (!state.recording) return;
    // Salva cópia exata
    state.recordedFrames.push({
        players: JSON.parse(JSON.stringify(state.players)),
        ball: state.ball ? JSON.parse(JSON.stringify(state.ball)) : null
    });
}

function playRecording() {
    if (state.recordedFrames.length === 0) return;
    state.playing = true;
    state.frameIndex = 0;
    
    // Backup estado atual
    const backup = {
        players: JSON.parse(JSON.stringify(state.players)),
        ball: state.ball ? JSON.parse(JSON.stringify(state.ball)) : null
    };

    function playFrame() {
        if (!state.playing || state.frameIndex >= state.recordedFrames.length) {
            state.playing = false;
            document.getElementById('btn-play').innerHTML = '<i class="fas fa-play"></i> Reproduzir';
            // Restaura backup após terminar
            state.players = backup.players;
            state.ball = backup.ball;
            render();
            return;
        }
        
        const frame = state.recordedFrames[state.frameIndex];
        state.players = frame.players;
        state.ball = frame.ball;
        render();
        
        state.frameIndex++;
        setTimeout(() => requestAnimationFrame(playFrame), 30); // ~30fps
    }
    
    document.getElementById('btn-play').innerHTML = '<i class="fas fa-stop"></i> Parar';
    playFrame();
}

// --- CONTROLES UI ---

function updateModeButton(btnId) {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(btnId).classList.add('active');
    
    canvas.className = '';
    if (state.mode === 'draw' || state.mode === 'erase') {
        canvas.classList.add('drawing');
    }
}

function resetSpecialMode() {
    state.mode = 'drag';
    state.actionData = {};
    state.actionStep = 0;
    document.querySelectorAll('.special-action').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.hint').forEach(h => h.style.display = 'none');
    updateModeButton('btn-pen'); // Falta um botão 'drag', usamos caneta como default ou criamos logic melhor.
    // Vamos deixar mode=drag invisível nos botões de tool
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    render();
}

// Ferramentas
document.getElementById('btn-pen').onclick = () => { resetSpecialMode(); state.mode = 'draw'; updateModeButton('btn-pen'); };
document.getElementById('btn-eraser').onclick = () => { resetSpecialMode(); state.mode = 'erase'; updateModeButton('btn-eraser'); };
document.getElementById('btn-undo').onclick = () => { state.lines.pop(); render(); };
document.getElementById('btn-clear-drawings').onclick = () => { state.lines = []; render(); };

// Rotação
document.getElementById('btn-orientation').onclick = () => {
    state.isVertical = !state.isVertical;
    resizeCanvas();
};

// Gravação
const btnRecord = document.getElementById('btn-record');
btnRecord.onclick = () => {
    if (state.playing) return;
    
    state.recording = !state.recording;
    if (state.recording) {
        state.recordedFrames = [];
        btnRecord.classList.add('recording');
        btnRecord.innerHTML = '<i class="fas fa-stop-circle"></i> Parando Gravação...';
        document.getElementById('btn-play').disabled = true;
        document.getElementById('btn-clear-record').disabled = true;
        recordFrame(); // Primeiro frame
    } else {
        btnRecord.classList.remove('recording');
        btnRecord.innerHTML = '<i class="fas fa-circle"></i> Gravar Jogada';
        document.getElementById('btn-play').disabled = state.recordedFrames.length === 0;
        document.getElementById('btn-clear-record').disabled = state.recordedFrames.length === 0;
    }
};

document.getElementById('btn-play').onclick = () => {
    if (state.playing) {
        state.playing = false; // Interrompe
    } else {
        playRecording();
    }
};

document.getElementById('btn-clear-record').onclick = () => {
    state.recordedFrames = [];
    document.getElementById('btn-play').disabled = true;
    document.getElementById('btn-clear-record').disabled = true;
};

// Local Storage
document.getElementById('btn-save').onclick = () => {
    const saveData = {
        players: state.players,
        ball: state.ball,
        lines: state.lines,
        isVertical: state.isVertical
    };
    localStorage.setItem('taticoWebSave', JSON.stringify(saveData));
    alert('Jogada salva com sucesso no navegador!');
};

document.getElementById('btn-load').onclick = () => {
    const data = localStorage.getItem('taticoWebSave');
    if (data) {
        const parsed = JSON.parse(data);
        state.players = parsed.players || [];
        state.ball = parsed.ball || null;
        state.lines = parsed.lines || [];
        state.isVertical = parsed.isVertical || false;
        resizeCanvas();
    } else {
        alert('Nenhum dado salvo encontrado.');
    }
};

// Adicionar Peças
document.getElementById('btn-add-a').onclick = () => {
    state.players.push({ id: Date.now(), team: 'A', x: canvas.width/2 - 20, y: canvas.height/2 });
    render(); recordFrame();
};
document.getElementById('btn-add-b').onclick = () => {
    state.players.push({ id: Date.now(), team: 'B', x: canvas.width/2 + 20, y: canvas.height/2 });
    render(); recordFrame();
};
document.getElementById('btn-add-ball').onclick = () => {
    state.ball = { x: canvas.width/2, y: canvas.height/2 };
    render(); recordFrame();
};
document.getElementById('btn-clear-board').onclick = () => {
    state.players = [];
    state.ball = null;
    state.lines = [];
    render(); recordFrame();
};

// Presets
document.getElementById('btn-preset-11').onclick = () => {
    state.players = [];
    const w = canvas.width;
    const h = canvas.height;
    
    // Simplificando formação 4-4-2 para A e B
    const xsA = [w*0.1, w*0.25, w*0.25, w*0.25, w*0.25, w*0.4, w*0.4, w*0.4, w*0.4, w*0.45, w*0.45];
    const ysA = [h*0.5, h*0.2, h*0.4, h*0.6, h*0.8, h*0.2, h*0.4, h*0.6, h*0.8, h*0.4, h*0.6];
    
    for(let i=0; i<11; i++) state.players.push({id: 'a'+i, team: 'A', x: xsA[i], y: ysA[i]});
    
    // B inverte X
    for(let i=0; i<11; i++) state.players.push({id: 'b'+i, team: 'B', x: w - xsA[i], y: ysA[i]});
    
    state.ball = { x: w/2, y: h/2 };
    render(); recordFrame();
};

document.getElementById('btn-preset-3').onclick = () => {
    state.players = [];
    const w = canvas.width;
    const h = canvas.height;
    
    // 3 atacantes A, 3 defensores B
    state.players.push({id: 'a1', team: 'A', x: w*0.4, y: h*0.2});
    state.players.push({id: 'a2', team: 'A', x: w*0.3, y: h*0.5});
    state.players.push({id: 'a3', team: 'A', x: w*0.4, y: h*0.8});
    
    state.players.push({id: 'b1', team: 'B', x: w*0.6, y: h*0.3});
    state.players.push({id: 'b2', team: 'B', x: w*0.7, y: h*0.5});
    state.players.push({id: 'b3', team: 'B', x: w*0.6, y: h*0.7});
    
    state.ball = { x: w*0.32, y: h*0.5 };
    render(); recordFrame();
};

// Ações Especiais
document.getElementById('btn-pass').onclick = (e) => {
    resetSpecialMode();
    state.mode = 'pass';
    e.target.classList.add('active');
    document.getElementById('hint-pass').style.display = 'block';
    document.getElementById('hint-pass').innerText = "Clique no jogador com a bola (Emissor).";
};

document.getElementById('btn-shoot').onclick = (e) => {
    resetSpecialMode();
    state.mode = 'shoot';
    e.target.classList.add('active');
    document.getElementById('hint-shoot').style.display = 'block';
};

// Start default (Modo arrastar implícito na inicialização)
setTimeout(() => {
    resizeCanvas();
    state.mode = 'drag'; // Default behavior is dragging
}, 100);
