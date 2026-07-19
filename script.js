// --- Bulletproof Architecture Matrix ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const speedVal = document.getElementById("speed-val");
const scoreVal = document.getElementById("score-val");

// Force internal drawing resolution to perfectly match your 800x600 layout frame
if (canvas) {
    canvas.width = 800;
    canvas.height = 600;
}

// --- Engine Configuration Settings ---
const TRACK_LENGTH = 600;    
const SEGMENT_LENGTH = 200;  
const RUMBLE_LENGTH = 3;     
const ROAD_WIDTH = 2000;     
const CAMERA_DEPTH = 0.84;   

// --- Operational Engine States ---
let playerX = 0;             
let position = 0;            
let speed = 0;               
const maxSpeed = 13500;      
const accel = 220;           
const breaking = -350;       
const decel = -100;          
let score = 0;
let gameOver = false;
let skyOffset = 0; 

// Realism & Physics Modifiers
let carBounceTimer = 0;
let screenShakeX = 0;
let screenShakeY = 0;

// --- Input Interception Framework (Spam Protected) ---
const keys = {};
let resetCooldown = false; 

window.addEventListener('keydown', e => { 
    keys[e.key] = true; 
    
    // Safety lock intercepts rapid Enter/Spacebar double-taps
    if (gameOver && (e.key === ' ' || e.key === 'Enter')) {
        if (!resetCooldown) {
            resetCooldown = true;
            resetGame();
            setTimeout(() => { resetCooldown = false; }, 400); 
        }
    }
});

window.addEventListener('keyup', e => { 
    keys[e.key] = false; 
});

// --- Vector Graphics Rendering Pipes ---
function drawPalmTree(ctx, x, y, scale) {
    if (!ctx) return;
    let trunkH = 140 * scale;
    let trunkW = 10 * scale;

    ctx.fillStyle = "#4a3227"; 
    ctx.beginPath();
    ctx.moveTo(x - trunkW/2, y);
    ctx.quadraticCurveTo(x - trunkW, y - trunkH*0.5, x + trunkW*0.5, y - trunkH);
    ctx.lineTo(x + trunkW * 1.5, y - trunkH);
    ctx.quadraticCurveTo(x, y - trunkH*0.5, x + trunkW/2, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0d470d"; 
    for(let i = 0; i < 7; i++) {
        let angle = (i * Math.PI / 3) - Math.PI/6;
        let leafLen = 45 * scale;
        ctx.beginPath();
        ctx.arc(x + trunkW*0.5 + Math.cos(angle)*leafLen*0.5, y - trunkH + Math.sin(angle)*leafLen*0.5, leafLen*0.5, 0, Math.PI*2);
        ctx.fill();
    }
}

function drawBillboard(ctx, x, y, scale, index) {
    if (!ctx) return;
    let w = 160 * scale;
    let h = 80 * scale;
    let postW = 8 * scale;
    let postH = 60 * scale;

    ctx.fillStyle = "#555555";
    ctx.fillRect(x - w*0.3 - postW/2, y - postH, postW, postH);
    ctx.fillRect(x + w*0.3 - postW/2, y - postH, postW, postH);

    ctx.fillStyle = "#111111";
    ctx.fillRect(x - w/2, y - postH - h, w, h);

    ctx.fillStyle = (index % 2 === 0) ? "#e6b800" : "#00b3db";
    ctx.fillRect(x - w/2 + 4, y - postH - h + 4, w - 8, h - 8);

    ctx.fillStyle = "#111111";
    ctx.font = `bold ${Math.max(6, Math.floor(14 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText((index % 2 === 0) ? "RACE" : "OUTRUN", x, y - postH - h/2 + 4);
}

// --- Procedural Generation Protocols ---
let segments = [];
function createTrack() {
    segments = [];
    for (let i = 0; i < TRACK_LENGTH; i++) {
        let curve = 0;
        if (i > 40 && i < 110) curve = 2.2;
        if (i > 170 && i < 240) curve = -3.4;
        if (i > 300 && i < 410) curve = 4.5;
        if (i > 460 && i < 530) curve = -2.0;

        let sprite = null;
        if (i % 7 === 0) {
            sprite = { type: 'tree', side: (Math.random() > 0.5 ? 1.6 : -1.6) };
        } else if (i % 19 === 0) {
            sprite = { type: 'billboard', side: (Math.random() > 0.5 ? 1.8 : -1.8) };
        }

        segments.push({
            index: i,
            p1: { world: { x: 0, y: 0, z: i * SEGMENT_LENGTH }, screen: { x: 0, y: 0, w: 0 } },
            p2: { world: { x: 0, y: 0, z: (i + 1) * SEGMENT_LENGTH }, screen: { x: 0, y: 0, w: 0 } },
            curve: curve,
            sprite: sprite,
            color: Math.floor(i / RUMBLE_LENGTH) % 2 ? 
                { road: '#292929', grass: '#144d14', rumble: '#cccccc', lane: '#ffffff' } : 
                { road: '#242424', grass: '#0f3d0f', rumble: '#b81022', lane: 'transparent' }
        });
    }
}

let cars = [];
function spawnCars() {
    cars = [];
    for (let i = 50; i < TRACK_LENGTH - 50; i += 28) {
        cars.push({
            z: i * SEGMENT_LENGTH,        
            laneX: (Math.random() * 1.5) - 0.75,        
            speed: maxSpeed * 0.45 + (Math.random() * maxSpeed * 0.35), 
            color: `hsl(${Math.random() * 360}, 75%, 40%)`,
            w: 460                                     
        });
    }
}

// --- Projection Math Matrix Transformation ---
function project(p, cameraX, cameraY, cameraZ) {
    if (!canvas) return;
    let transX = p.world.x - cameraX;
    let transY = p.world.y - cameraY;
    let transZ = p.world.z - cameraZ;

    if (transZ <= 0) transZ = 1;
    let scale = CAMERA_DEPTH / transZ;

    p.screen.x = Math.round((canvas.width / 2) + (scale * transX * canvas.width / 2));
    p.screen.y = Math.round((canvas.height / 2) - (scale * transY * canvas.height / 2));
    p.screen.w = Math.round(scale * ROAD_WIDTH * canvas.width / 2);
}

function drawPolygon(x1, y1, w1, x2, y2, w2, color, fogDensity = 0) {
    if (!ctx || color === 'transparent') return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x2 - w2, y2);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x1 + w1, y1);
    ctx.closePath();
    ctx.fill();

    // Fog Depth Overlay
    if (fogDensity > 0) {
        ctx.fillStyle = `rgba(247, 158, 59, ${fogDensity})`; 
        ctx.beginPath();
        ctx.moveTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x1 + w1, y1);
        ctx.closePath();
        ctx.fill();
    }
}

function drawPseudo3DCar(x, y, width, height, baseColor, isPlayer = false) {
    if (!ctx) return;
    if (width < 12) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(x - width / 2, y - height, width, height);
        return;
    }

    let wheelW = width * 0.19;
    let wheelH = height * 0.46;
    let cabinW = width * 0.72;
    let cabinH = height * 0.48;

    ctx.fillStyle = "#111111";
    ctx.fillRect(x - width / 2, y - wheelH, wheelW, wheelH); 
    ctx.fillRect(x + width / 2 - wheelW, y - wheelH, wheelW, wheelH); 

    ctx.fillStyle = "#181818";
    ctx.fillRect(x - width / 2 - 2, y - height, width + 4, height * 0.14);

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, y - wheelH * 0.4);
    ctx.lineTo(x - width / 2 + 3, y - height * 0.58);
    ctx.lineTo(x - cabinW / 2, y - height * 0.58);
    ctx.lineTo(x - cabinW * 0.38, y - height + 3);
    ctx.lineTo(x + cabinW * 0.38, y - height + 3);
    ctx.lineTo(x + cabinW / 2, y - height * 0.58);
    ctx.lineTo(x + width / 2 - 3, y - height * 0.58);
    ctx.lineTo(x + width / 2, y - wheelH * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1a2430";
    ctx.beginPath();
    ctx.moveTo(x - cabinW * 0.38, y - height * 0.58);
    ctx.lineTo(x - cabinW * 0.28, y - height + 6);
    ctx.lineTo(x + cabinW * 0.28, y - height + 6);
    ctx.lineTo(x + cabinW * 0.38, y - height * 0.58);
    ctx.closePath();
    ctx.fill();

    if (isPlayer && (keys['ArrowDown'] || keys['s'] || keys['S'])) {
        ctx.fillStyle = "#ff0000"; 
    } else {
        ctx.fillStyle = "#910000"; 
    }
    ctx.fillRect(x - width * 0.44, y - height * 0.5, width * 0.16, height * 0.11);
    ctx.fillRect(x + width * 0.44 - (width * 0.16), y - height * 0.5, width * 0.16, height * 0.11);
}

function resetGame() {
    let overlay = document.getElementById("over-screen");
    if (overlay) overlay.style.display = "none";

    playerX = 0;
    position = 0;
    speed = 0;
    score = 0;
    gameOver = false;
    skyOffset = 0;
    carBounceTimer = 0;
    screenShakeX = 0;
    screenShakeY = 0;
    createTrack();
    spawnCars();
}

createTrack();
spawnCars();

// --- Main Engine Calculations Pipe ---
function update(dt) {
    if (gameOver) return;

    const trackTotalLength = TRACK_LENGTH * SEGMENT_LENGTH;
    position += speed * dt;
    while (position >= trackTotalLength) position -= trackTotalLength; 
    while (position < 0) position += trackTotalLength;

    let currentSegIndex = Math.floor(position / SEGMENT_LENGTH) % TRACK_LENGTH;
    let currentSegment = segments[currentSegIndex];
    
    if (speedVal) speedVal.innerText = Math.round(speed / 100);
    if (scoreVal) scoreVal.innerText = score;

    if (keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' ']) {
        // Trigger start and hide splashscreen if player hits space/up to start racing
        let overlay = document.getElementById("over-screen");
        if (overlay && overlay.style.display !== "none") overlay.style.display = "none";
        speed += accel;
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        speed += breaking;
    } else {
        speed += decel; 
    }

    let speedRatio = (speed / maxSpeed);
    
    // Dynamic Engine Vibrations
    if (speedRatio > 0.4) {
        carBounceTimer += dt * (speedRatio * 25);
        screenShakeX = (Math.random() - 0.5) * (speedRatio * 2.5);
        screenShakeY = (Math.random() - 0.5) * (speedRatio * 1.5);
    } else {
        carBounceTimer = 0;
        screenShakeX = 0;
        screenShakeY = 0;
    }

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        playerX -= 0.042 * speedRatio;
        if(speed > 0 && currentSegment) {
            skyOffset += currentSegment.curve * 0.3 * speedRatio + 1.5;
            screenShakeX += (Math.random() - 0.3) * 1.5; 
        }
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        playerX += 0.042 * speedRatio;
        if(speed > 0 && currentSegment) {
            skyOffset += currentSegment.curve * 0.3 * speedRatio - 1.5;
            screenShakeX -= (Math.random() - 0.3) * 1.5; 
        }
    } else {
        if(speed > 0 && currentSegment && currentSegment.curve !== 0) {
            skyOffset += currentSegment.curve * 0.6 * speedRatio;
        }
    }

    if (currentSegment) {
        playerX -= currentSegment.curve * 0.016 * speedRatio;
    }

    if (playerX < -0.9) playerX = -0.9;
    if (playerX > 0.9) playerX = 0.9;

    if (speed < 0) speed = 0;
    if (speed > maxSpeed) speed = maxSpeed;

    if (speed > 100) {
        score += Math.floor(speed / 2500);
    }

    cars.forEach(car => {
        car.z += car.speed * dt;
        while (car.z >= trackTotalLength) car.z -= trackTotalLength;
        while (car.z < 0) car.z += trackTotalLength;

        let zDiff = Math.abs(position - car.z);
        if (zDiff < 260 || zDiff > trackTotalLength - 260) {
            let distanceX = Math.abs(playerX - car.laneX);
            if (distanceX < 0.44) {
                speed = 0;
                gameOver = true;
            }
        }
    });
}

// --- Graphics Paint Buffer Loop ---
function render() {
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

    // 1. Synthwave Sky
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
    skyGrad.addColorStop(0, "#130624"); 
    skyGrad.addColorStop(0.4, "#521442"); 
    skyGrad.addColorStop(0.75, "#b83925"); 
    skyGrad.addColorStop(1, "#f79e3b"); 
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

    // 2. Neon Sun & Parallax Ranges
    let sunX = (canvas.width * 0.7) + (skyOffset * 0.1); 
    ctx.fillStyle = "#ffcc00"; 
    ctx.beginPath();
    ctx.arc(sunX, canvas.height / 2 - 10, 50, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#b83925";
    ctx.fillRect(sunX - 55, canvas.height / 2 - 25, 110, 2);
    ctx.fillRect(sunX - 55, canvas.height / 2 - 15, 110, 3);
    ctx.fillRect(sunX - 55, canvas.height / 2 - 5, 110, 4);

    ctx.fillStyle = "#2d0e28";
    for (let m = -2; m < 6; m++) {
        let mX = (m * 300) + (skyOffset % 300);
        ctx.beginPath();
        ctx.moveTo(mX, canvas.height / 2);
        ctx.lineTo(mX + 150, canvas.height / 2 - 45);
        ctx.lineTo(mX + 300, canvas.height / 2);
        ctx.closePath();
        ctx.fill();
    }

    // 3. Landscape Base
    ctx.fillStyle = "#0a260a"; 
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    const trackTotalLength = TRACK_LENGTH * SEGMENT_LENGTH;
    let cameraHeight = 1500;
    let startSegIndex = Math.floor(position / SEGMENT_LENGTH) % TRACK_LENGTH;
    let baseSegment = segments[startSegIndex];
    
    if (!baseSegment) { ctx.restore(); return; }

    let maxy = canvas.height;
    let xOffset = 0;
    let dx = -(baseSegment.curve * (position % SEGMENT_LENGTH / SEGMENT_LENGTH));

    let drawQueue = [];
    let maxDrawSegments = 140;

    // Loop 3A: Draw 3D Ground Mesh
    for (let i = 0; i < maxDrawSegments; i++) {
        let targetIndex = (startSegIndex + i) % TRACK_LENGTH;
        let segment = segments[targetIndex];
        if (!segment) continue;
        
        let loopZ = (targetIndex < startSegIndex) ? trackTotalLength : 0;

        project(segment.p1, playerX * (ROAD_WIDTH * 0.54) - xOffset, cameraHeight, position - loopZ);
        project(segment.p2, playerX * (ROAD_WIDTH * 0.54) - xOffset - dx, cameraHeight, position - loopZ);

        xOffset += dx;
        dx += segment.curve;

        let p1 = segment.p1.screen;
        let p2 = segment.p2.screen;

        if (p1.y >= maxy || p2.y >= p1.y) continue;
        maxy = p1.y;

        let fogDensity = Math.pow((i / maxDrawSegments), 2.5);

        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);
        ctx.fillStyle = `rgba(247, 158, 59, ${fogDensity})`;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);

        let rumble1 = p1.w * 0.11;
        let rumble2 = p2.w * 0.11;
        let laneW1 = p1.w * 0.02;
        let laneW2 = p2.w * 0.02;

        drawPolygon(p1.x, p1.y, p1.w + rumble1, p2.x, p2.y, p2.w + rumble2, segment.color.rumble, fogDensity);
        drawPolygon(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, segment.color.road, fogDensity);
        drawPolygon(p1.x, p1.y, laneW1, p2.x, p2.y, laneW2, segment.color.lane, fogDensity);

        if (segment.sprite) {
            drawQueue.push({
                type: 'sprite',
                spriteData: segment.sprite,
                index: segment.index,
                screenX: p1.x + (p1.w * segment.sprite.side),
                screenY: p1.y,
                scale: p1.w / ROAD_WIDTH
            });
        }
    }

    // Loop 3B: Side Objects
    for (let i = drawQueue.length - 1; i >= 0; i--) {
        let item = drawQueue[i];
        if (item.type === 'sprite') {
            if (item.spriteData.type === 'tree') {
                drawPalmTree(ctx, item.screenX, item.screenY, item.scale * 4.5);
            } else if (item.spriteData.type === 'billboard') {
                drawBillboard(ctx, item.screenX, item.screenY, item.scale * 4.0, item.index);
            }
        }
    }

    // Loop 3C: Traffic Car Engine Layers
    for (let i = cars.length - 1; i >= 0; i--) {
        let car = cars[i];
        let relativeZ = car.z - position;
        if (relativeZ < 0) relativeZ += trackTotalLength;

        if (relativeZ > 0 && relativeZ < maxDrawSegments * SEGMENT_LENGTH) {
            let carSegIndex = Math.floor(car.z / SEGMENT_LENGTH) % TRACK_LENGTH;
            let seg = segments[carSegIndex];
            if (!seg) continue;

            let scale = CAMERA_DEPTH / relativeZ;
            let carX = seg.p1.screen.x + (scale * (car.laneX - playerX) * (ROAD_WIDTH * 0.54) * canvas.width / 2);
            let carY = seg.p1.screen.y;
            let carW = scale * car.w * canvas.width / 2;
            let carH = carW * 0.54;

            let enemyBounce = Math.sin((car.z * 0.05)) * 0.8;
            drawPseudo3DCar(carX, carY + enemyBounce, carW, carH, car.color, false);
        }
    }

    // 4. Primary Player Cockpit Vector Layer
    let pCarW = 160;
    let pCarH = 88;
    let pCarX = canvas.width / 2;
    
    let pCarBounce = (speed > 0) ? Math.sin(carBounceTimer) * 1.4 : 0;
    let pCarY = (canvas.height - 25) + pCarBounce;
    
    drawPseudo3DCar(pCarX, pCarY, pCarW, pCarH, "#00e5ff", true);

    // 5. Game Over Prompt
    if (gameOver) {
        ctx.fillStyle = "rgba(12, 5, 24, 0.88)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#ff0066";
        ctx.font = "bold 44px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText("CRASHED!", canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px 'Courier New'";
        ctx.fillText(`FINAL SCORE: ${score} | Hit SPACEBAR to race again`, canvas.width / 2, canvas.height / 2 + 35);
    }

    ctx.restore(); 
}

// --- Main Loop Tick ---
let lastTime = performance.now();
function gameLoop() {
    try {
        let now = performance.now();
        let dt = Math.min(0.1, (now - lastTime) / 1000); 
        lastTime = now;

        update(dt);
        render();
    } catch (e) {
        // Safe catch bypasses render halts completely
    }
    requestAnimationFrame(gameLoop);
}

gameLoop();
