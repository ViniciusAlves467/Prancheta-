const canvas = document.getElementById('tactical-board');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// Estado global
let state = {
    isVertical: false,
    players: [],
    ball: null,
    ballOwner: null, // Novo: rastreia quem está com a bola
    isBallAnimating: false,
    lines: [],
    currentLine: null,
    mode: 'drag',
    isDragging: false,
    draggedItem: null,
    recording: false,
    playing: false,
    recordedFrames: [],
    frameIndex: 0
};

let savedPlays = JSON.parse(localStorage.getItem('taticoWebPlays')) || [];

// TAMANHOS AUMENTADOS EM 50%
const PLAYER_RADIUS = 12; 
const BALL_RADIUS = 6;     

function resizeCanvas() {
    const margin = 40;
    const cw = container.clientWidth - margin * 2;
    const ch = container.clientHeight - margin * 2;
    const ratio = state.isVertical ? 68/105 : 105/68;
    
    let w = cw; let h = cw / ratio;
    if (h > ch) { h = ch; w = h * ratio; }
    
    canvas.width = w; canvas.height = h;
    ensureGoalkeepers();
    updateBallPos();
    render();
}
window.addEventListener('resize', resizeCanvas);

function ensureGoalkeepers() {
    state.players = state.players.filter(p => !p.isGK);
    const w = canvas.width, h = canvas.height;
    if (!state.isVertical) {
        state.players.push({ id: 'gk_A', team: 'A', isGK: true, x: 15, y: h/2 });
        state.players.push({ id: 'gk_B', team: 'B', isGK: true, x: w - 15, y: h/2 });
    } else {
        state.players.push({ id: 'gk_A', team: 'A', isGK: true, x: w/2, y: 15 });
        state.players.push({ id: 'gk_B', team: 'B', isGK: true, x: w/2, y: h - 15 });
    }
}

// --- DESIGN DO CAMPO MODERNO ---
function drawField() {
    const w = canvas.width, h = canvas.height;
    
    // Gramado base
    ctx.fillStyle = '#2E7D32'; 
    ctx.fillRect(0, 0, w, h);
    
    // Faixas de grama
    ctx.fillStyle = '#388E3C';
    const stripeCount = 12;
    if (!state.isVertical) {
        const stripeW = w / stripeCount;
        for(let i=0; i<stripeCount; i+=2) ctx.fillRect(i * stripeW, 0, stripeW, h);
    } else {
        const stripeH = h / stripeCount;
        for(let i=0; i<stripeCount; i+=2) ctx.fillRect(0, i * stripeH, w, stripeH);
    }
    
    // Linhas do campo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; 
    ctx.lineWidth = 2.5;
    ctx.strokeRect(10, 10, w - 20, h - 20); // Borda
    
    if (!state.isVertical) {
        // Meio campo
        ctx.beginPath(); ctx.moveTo(w/2, 10); ctx.lineTo(w/2, h-10); ctx.stroke();
        ctx.beginPath(); ctx.arc(w/2, h/2, h/6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(w/2, h/2, 3, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
        
        // Áreas
        ctx.strokeRect(10, h/2 - h/4, w/6, h/2);
        ctx.strokeRect(10, h/2 - h/8, w/12, h/4);
        ctx.strokeRect(w - 10 - w/6, h/2 - h/4, w/6, h/2);
        ctx.strokeRect(w - 10 - w/12, h/2 - h/8, w/12, h/4);
        
        // Meia-lua
        ctx.beginPath(); ctx.arc(10 + w/6, h/2, h/10, -Math.PI/4, Math.PI/4); ctx.stroke();
        ctx.beginPath(); ctx.arc(w - 10 - w/6, h/2, h/10, Math.PI - Math.PI/4, Math.PI + Math.PI/4); ctx.stroke();
        
        // Gols
        ctx.strokeRect(0, h/2 - h/12, 10, h/6);
        ctx.strokeRect(w-10, h/2 - h/12, 10, h/6);
    } else {
        // Meio campo
        ctx.beginPath(); ctx.moveTo(10, h/2); ctx.lineTo(w-10, h/2); ctx.stroke();
        ctx.beginPath(); ctx.arc(w/2, h/2, w/6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(w/2, h/2, 3, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
        
        // Áreas
        ctx.strokeRect(w/2 - w/4, 10, w/2, h/6);
        ctx.strokeRect(w/2 - w/8, 10, w/4, h/12);
        ctx.strokeRect(w/2 - w/4, h - 10 - h/6, w/2, h/6);
        ctx.strokeRect(w/2 - w/8, h - 10 - h/12, w/4, h/12);
        
        // Meia-lua
        ctx.beginPath(); ctx.arc(w/2, 10 + h/6, w/10, Math.PI/4, Math.PI - Math.PI/4); ctx.stroke();
        ctx.beginPath(); ctx.arc(w/2, h - 10 - h/6, w/10, Math.PI + Math.PI/4, Math.PI*2 - Math.PI/4); ctx.stroke();
        
        // Gols
        ctx.strokeRect(w/2 - w/12, 0, w/6, 10);
        ctx.strokeRect(w/2 - w/12, h-10, w/6, 10);
    }
}

function drawPlayersAndBall() {
    // Efeito 3D (Sombra)
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    state.players.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = p.team === 'A' ? (p.isGK ? '#0D47A1' : '#1976D2') : (p.isGK ? '#880E4F' : '#C62828');
        ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    
    // Bola colada no jogador
    if (state.ball) {
        ctx.beginPath();
        ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
        
        // Detalhe da bola
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS * 0.4, 0, Math.PI * 2); ctx.fill();
        for(let i=0; i<5; i++){
            let angle = (i * Math.PI * 2) / 5;
            let dotX = state.ball.x + Math.cos(angle) * BALL_RADIUS * 0.7;
            let dotY = state.ball.y + Math.sin(angle) * BALL_RADIUS * 0.7;
            ctx.beginPath(); ctx.arc(dotX, dotY, 0.8, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.shadowColor = 'transparent'; // Reset sombra para não borrar linhas
}

function drawLines() {
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const allLines = [...state.lines];
    if (state.currentLine) allLines.push(state.currentLine);
    
    allLines.forEach(line => {
        if (line.points.length < 2) return;
        ctx.strokeStyle = line.color;
        ctx.beginPath();
        ctx.moveTo(line.points[0].x, line.points[0].y);
        for(let i=1; i<line.points.length; i++) ctx.lineTo(line.points[i].x, line.points[i].y);
        ctx.stroke();
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawField(); drawLines(); drawPlayersAndBall();
}

// --- FÍSICA DA POSSE DE BOLA ---
function updateBallPos() {
    if (state.ballOwner && state.ball && !state.isBallAnimating) {
        const p = state.ballOwner;
        const offset = PLAYER_RADIUS + BALL_RADIUS + 2; // Bola colada à frente
        if (!state.isVertical) {
            state.ball.x = p.team === 'A' ? p.x + offset : p.x - offset;
            state.ball.y = p.y;
        } else {
            state.ball.x = p.x;
            state.ball.y = p.team === 'A' ? p.y + offset : p.y - offset;
        }
    }
}

// --- INTERAÇÕES MOUSE ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function getHoveredItem(pos) {
    // Bola não é mais clicável isoladamente
    for (let i = state.players.length - 1; i >= 0; i--) {
        const p = state.players[i];
        const dist = Math.hypot(pos.x - p.x, pos.y - p.y);
        if (dist <= PLAYER_RADIUS + 4) return { type: 'player', item: p };
    }
    return null;
}

canvas.addEventListener('mousedown', (e) => {
    if (state.playing) return;
    const pos = getMousePos(e);
    
    if (state.mode === 'drag') {
        const hovered = getHoveredItem(pos);
        if (hovered && !hovered.item.isGK) {
            state.isDragging = true;
            state.draggedItem = hovered.item;
        }
    } else if (state.mode === 'draw') {
        state.currentLine = { color: '#FFFF00', points: [pos] };
    } else if (state.mode === 'erase') {
         state.lines = state.lines.filter(line => !line.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 15));
         render();
    } else if (state.mode === 'pass') {
        const hovered = getHoveredItem(pos);
        if (hovered && hovered.type === 'player') {
            const receiver = hovered.item;
            if (receiver === state.ballOwner) alert("Ele já está com a bola!");
            else if (receiver.team !== state.ballOwner.team) alert("O passe deve ser para o mesmo time.");
            else { 
                const offset = PLAYER_RADIUS + BALL_RADIUS + 2;
                let targetX = receiver.x, targetY = receiver.y;
                if (!state.isVertical) targetX = receiver.team === 'A' ? receiver.x + offset : receiver.x - offset;
                else targetY = receiver.team === 'A' ? receiver.y + offset : receiver.y - offset;
                
                animateBall(targetX, targetY, receiver); 
                resetSpecialMode(); 
            }
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (state.playing) return;
    const pos = getMousePos(e);
    if (state.isDragging && state.draggedItem) {
        state.draggedItem.x = pos.x; state.draggedItem.y = pos.y;
        
        // Lógica de "Pegar a bola" ao se aproximar
        if (!state.ballOwner && state.ball && !state.isBallAnimating) {
            const dist = Math.hypot(state.draggedItem.x - state.ball.x, state.draggedItem.y - state.ball.y);
            if (dist < PLAYER_RADIUS + BALL_RADIUS + 10) state.ballOwner = state.draggedItem;
        }
        
        updateBallPos();
        render(); recordFrame();
    } else if (state.mode === 'draw' && state.currentLine) {
        state.currentLine.points.push(pos); render();
    } else if (state.mode === 'erase' && e.buttons === 1) {
         state.lines = state.lines.filter(line => !line.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 15));
         render();
    }
});

canvas.addEventListener('mouseup', () => { state.isDragging = false; state.draggedItem = null; if (state.mode === 'draw' && state.currentLine) { state.lines.push(state.currentLine); state.currentLine = null; render(); } });
canvas.addEventListener('mouseleave', () => { state.isDragging = false; state.draggedItem = null; if (state.mode === 'draw' && state.currentLine) { state.lines.push(state.currentLine); state.currentLine = null; } });

// --- ANIMAÇÃO BOLA ---
function animateBall(targetX, targetY, receiver = null) {
    if (!state.ball) return;
    state.isBallAnimating = true;
    state.ballOwner = null; // Solta a bola durante a animação
    const speed = 14;
    
    function step() {
        if (!state.ball || state.playing) { state.isBallAnimating = false; return; }
        const dx = targetX - state.ball.x, dy = targetY - state.ball.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > speed) {
            state.ball.x += (dx / dist) * speed; state.ball.y += (dy / dist) * speed;
            render(); recordFrame(); requestAnimationFrame(step);
        } else {
            state.ball.x = targetX; state.ball.y = targetY; 
            state.isBallAnimating = false;
            if (receiver) { state.ballOwner = receiver; updateBallPos(); }
            render(); recordFrame();
        }
    }
    step();
}

// --- GRAVAÇÃO E PLAYBACK ---
function recordFrame() {
    if (!state.recording) return;
    state.recordedFrames.push({
        players: JSON.parse(JSON.stringify(state.players)),
        ball: state.ball ? JSON.parse(JSON.stringify(state.ball)) : null
    });
}

function playRecording(framesToPlay = null) {
    const frames = framesToPlay || state.recordedFrames;
    if (frames.length === 0) return;
    state.playing = true; state.frameIndex = 0;
    const backup = { players: JSON.parse(JSON.stringify(state.players)), ball: state.ball ? JSON.parse(JSON.stringify(state.ball)) : null };

    function playFrame() {
        if (!state.playing || state.frameIndex >= frames.length) {
            state.playing = false;
            document.getElementById('btn-play').innerHTML = '<i class="fas fa-play"></i> Reproduzir Atual';
            state.players = backup.players; state.ball = backup.ball; updateBallPos(); render();
            return;
        }
        const frame = frames[state.frameIndex];
        state.players = frame.players; state.ball = frame.ball; render();
        state.frameIndex++; setTimeout(() => requestAnimationFrame(playFrame), 30);
    }
    document.getElementById('btn-play').innerHTML = '<i class="fas fa-stop"></i> Parar Reprodução';
    playFrame();
}

// --- CONTROLES UI E MODAL ---
function resetSpecialMode() {
    state.mode = 'drag';
    document.querySelectorAll('.special-action').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.hint').forEach(h => h.style.display = 'none');
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    canvas.className = ''; render();
}

document.getElementById('btn-pen').onclick = () => { resetSpecialMode(); state.mode = 'draw'; canvas.className = 'drawing'; };
document.getElementById('btn-eraser').onclick = () => { resetSpecialMode(); state.mode = 'erase'; canvas.className = 'drawing'; };
document.getElementById('btn-undo').onclick = () => { state.lines.pop(); render(); };
document.getElementById('btn-clear-drawings').onclick = () => { state.lines = []; render(); };

// --- ROTAÇÃO CORRIGIDA (Ir e Voltar) ---
document.getElementById('btn-orientation').onclick = () => {
    const oldW = canvas.width, oldH = canvas.height;
    state.isVertical = !state.isVertical;
    resizeCanvas();
    const newW = canvas.width, newH = canvas.height;

    state.players.forEach(p => {
        if(!p.isGK){
            let px = p.x / oldW, py = p.y / oldH;
            // Troca limpa de eixos garante o "ir e voltar"
            p.x = py * newW; 
            p.y = px * newH;
        }
    });
    if (state.ball && !state.ballOwner) {
        let px = state.ball.x / oldW, py = state.ball.y / oldH;
        state.ball.x = py * newW; state.ball.y = px * newH;
    }
    ensureGoalkeepers(); updateBallPos(); render();
};

const btnRecord = document.getElementById('btn-record');
btnRecord.onclick = () => {
    if (state.playing) return;
    state.recording = !state.recording;
    if (state.recording) {
        state.recordedFrames = []; btnRecord.classList.add('recording');
        btnRecord.innerHTML = '<i class="fas fa-stop-circle"></i> Parando Gravação...';
        document.getElementById('btn-play').disabled = true;
        document.getElementById('btn-clear-record').disabled = true;
        recordFrame();
    } else {
        btnRecord.classList.remove('recording');
        btnRecord.innerHTML = '<i class="fas fa-circle"></i> Gravar Jogada';
        document.getElementById('btn-play').disabled = state.recordedFrames.length === 0;
        document.getElementById('btn-clear-record').disabled = state.recordedFrames.length === 0;
        if (state.recordedFrames.length > 0) showSavePlayModal();
    }
};

document.getElementById('btn-play').onclick = () => { if (state.playing) state.playing = false; else playRecording(); };
document.getElementById('btn-clear-record').onclick = () => { state.recordedFrames = []; document.getElementById('btn-play').disabled = true; document.getElementById('btn-clear-record').disabled = true; };

function renderSavedPlays() {
    const list = document.getElementById('plays-list'); list.innerHTML = '';
    savedPlays.forEach((p, i) => {
        const li = document.createElement('li'); li.innerText = p.name;
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '<i class="fas fa-play"></i>'; playBtn.className = 'mini-btn'; 
        playBtn.onclick = () => playRecording(p.frames);
        li.appendChild(playBtn); list.appendChild(li);
    });
}

function showSavePlayModal() {
    const modal = document.getElementById('modal-save-play');
    const replaceSec = document.getElementById('replace-section');
    const select = document.getElementById('replace-select');
    document.getElementById('play-name').value = '';
    
    if (savedPlays.length >= 3) {
        replaceSec.style.display = 'block'; select.innerHTML = '';
        savedPlays.forEach((p, i) => {
            const opt = document.createElement('option'); opt.value = i; opt.text = p.name; select.appendChild(opt);
        });
    } else { replaceSec.style.display = 'none'; }
    modal.style.display = 'flex';
}

document.getElementById('btn-confirm-save').onclick = () => {
    const name = document.getElementById('play-name').value || `Jogada ${savedPlays.length + 1}`;
    const newPlay = { name, frames: state.recordedFrames };
    if (savedPlays.length >= 3) savedPlays[document.getElementById('replace-select').value] = newPlay;
    else savedPlays.push(newPlay);
    localStorage.setItem('taticoWebPlays', JSON.stringify(savedPlays));
    renderSavedPlays(); document.getElementById('modal-save-play').style.display = 'none';
};
document.getElementById('btn-cancel-save').onclick = () => { document.getElementById('modal-save-play').style.display = 'none'; };

document.getElementById('btn-save').onclick = () => {
    localStorage.setItem('taticoWebSave', JSON.stringify({ players: state.players, ball: state.ball, lines: state.lines, isVertical: state.isVertical }));
    alert('Formação atual salva no navegador!');
};
document.getElementById('btn-load').onclick = () => {
    const data = localStorage.getItem('taticoWebSave');
    if (data) {
        const p = JSON.parse(data); state.players = p.players || []; state.ball = p.ball || null; state.lines = p.lines || []; state.isVertical = p.isVertical || false;
        state.ballOwner = null; resizeCanvas();
    }
};

// Peças
document.getElementById('btn-add-a').onclick = () => { state.players.push({ id: Date.now(), team: 'A', x: canvas.width/2 - 40, y: canvas.height/2, isGK: false }); render(); recordFrame(); };
document.getElementById('btn-add-b').onclick = () => { state.players.push({ id: Date.now(), team: 'B', x: canvas.width/2 + 40, y: canvas.height/2, isGK: false }); render(); recordFrame(); };
document.getElementById('btn-add-ball').onclick = () => { state.ball = { x: canvas.width/2, y: canvas.height/2 }; state.ballOwner = null; render(); recordFrame(); };
document.getElementById('btn-clear-board').onclick = () => { state.players = []; state.ball = { x: canvas.width/2, y: canvas.height/2 }; state.ballOwner = null; state.lines = []; ensureGoalkeepers(); render(); recordFrame(); };

function getCoords(px, py) { return state.isVertical ? { x: py * canvas.width, y: px * canvas.height } : { x: px * canvas.width, y: py * canvas.height }; }

document.getElementById('btn-preset-11').onclick = () => {
    state.players = []; ensureGoalkeepers();
    const xsA = [0.25, 0.25, 0.25, 0.25, 0.4, 0.4, 0.4, 0.4, 0.45, 0.45];
    const ysA = [0.2,  0.4,  0.6,  0.8,  0.2, 0.4, 0.6, 0.8, 0.4,  0.6];
    
    for(let i=0; i<10; i++) {
        let posA = getCoords(xsA[i], ysA[i]);
        state.players.push({id: 'a'+i, team: 'A', x: posA.x, y: posA.y, isGK: false});
        let posB = getCoords(1 - xsA[i], ysA[i]);
        state.players.push({id: 'b'+i, team: 'B', x: posB.x, y: posB.y, isGK: false});
    }
    let ballPos = getCoords(0.5, 0.5); state.ball = { x: ballPos.x, y: ballPos.y }; state.ballOwner = null;
    render(); recordFrame();
};

document.getElementById('btn-preset-3').onclick = () => {
    state.players = []; ensureGoalkeepers();
    const posAtk = [getCoords(0.4, 0.2), getCoords(0.3, 0.5), getCoords(0.4, 0.8)];
    const posDef = [getCoords(0.6, 0.3), getCoords(0.7, 0.5), getCoords(0.6, 0.7)];
    
    for(let i=0; i<3; i++){
        state.players.push({id: 'a'+i, team: 'A', x: posAtk[i].x, y: posAtk[i].y, isGK: false});
        state.players.push({id: 'b'+i, team: 'B', x: posDef[i].x, y: posDef[i].y, isGK: false});
    }
    let ballPos = getCoords(0.5, 0.5); state.ball = { x: ballPos.x, y: ballPos.y }; state.ballOwner = null;
    render(); recordFrame();
};

// --- CHUTE CORRIGIDO ---
document.getElementById('btn-shoot').onclick = () => {
    if (!state.ballOwner) {
        alert("Nenhum jogador está com a bola! Aproxime um jogador da bola para dominá-la primeiro.");
        return;
    }
    resetSpecialMode();
    const shooter = state.ballOwner;
    let goalX, goalY;
    if (!state.isVertical) {
        goalX = shooter.team === 'A' ? canvas.width : 0;
        goalY = canvas.height/2;
    } else {
        goalX = canvas.width/2;
        goalY = shooter.team === 'A' ? canvas.height : 0;
    }
    
    animateBall(goalX, goalY); 
};

// --- PASSE CORRIGIDO ---
document.getElementById('btn-pass').onclick = (e) => {
    if (!state.ballOwner) {
        alert("Nenhum jogador está com a bola! Aproxime um jogador da bola para dominá-la primeiro.");
        return;
    }
    resetSpecialMode(); state.mode = 'pass'; e.target.classList.add('active');
    document.getElementById('hint-pass').style.display = 'block';
};

// Start
setTimeout(() => { 
    state.ball = { x: 0, y: 0 }; 
    resizeCanvas(); state.ball.x = canvas.width/2; state.ball.y = canvas.height/2; 
    state.mode = 'drag'; renderSavedPlays(); 
}, 100);
