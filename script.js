 // --- Core Engine Framework ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const speedVal = document.getElementById("speed-val");
const scoreVal = document.getElementById("score-val");

if (canvas) {
    canvas.width = 800;
    canvas.height = 600;
}

// --- World Geometry Adjustments ---
const TRACK_LENGTH = 1200;    
const SEGMENT_LENGTH = 160;  
const RUMBLE_LENGTH = 4;     
const ROAD_WIDTH = 2200;     
const CAMERA_DEPTH = 0.84;   

// --- Physics State Engines ---
let playerX = 0;             
let position = 0;            
let speed = 0;               
const maxSpeed = 12000;      // ~120 MPH cap for realism
const accel = 180;           
const breaking = -400;       

// Vibration/Bounce Vectors
let carBounceTimer = 0;
let screenShakeX = 0;
let screenShakeY = 0;
let chassisRoll = 0; 

let skyOffset = 0; 
let score = 0;
let gameOver = false;

// --- Input Map Matrix ---
const keys = {};
let resetCooldown = false; 

window.addEventListener('keydown', e => { 
    keys[e.key] = true; 
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

// --- Realistic Asset Painters ---
function drawRealisticTree(ctx, x, y, scale) {
    if (!ctx) return;
    let trunkH = 160 * scale;
    let trunkW = 14 * scale;

    // Soft organic shadowing
    ctx.fillStyle = "rgba(10, 15, 10, 0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y, 40 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Weathered Trunk
    ctx.fillStyle = "#3e2723"; 
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);

    // Layered Evergreen Foliage Cone
    ctx.fillStyle = "#1e3f20"; 
    ctx.beginPath();
    ctx.moveTo(x - 55 * scale, y - trunkH * 0.3);
    ctx.lineTo(x + 55 * scale, y - trunkH * 0.3);
    ctx.lineTo(x, y - trunkH - 60 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#152e17"; // Shaded interior canopy layer
    ctx.beginPath();
    ctx.moveTo(x - 40 * scale, y - trunkH * 0.6);
    ctx.lineTo(x + 40 * scale, y - trunkH * 0.6);
    ctx.lineTo(x, y - trunkH - 60 * scale);
    ctx.closePath();
    ctx.fill();
}

function drawHighwaySign(ctx, x, y, scale, index) {
    if (!ctx) return;
    let w = 180 * scale;
    let h = 95 * scale;
    let postW = 6 * scale;
    let postH = 130 * scale;

    // Structural Posts
    ctx.fillStyle = "#7f8c8d";
    ctx.fillRect(x - w * 0.35 - postW / 2, y - postH, postW, postH);
    ctx.fillRect(x + w * 0.35 - postW / 2, y - postH, postW, postH);

    // Standard Interstate Green Frame
    ctx.fillStyle = "#0f5132";
    ctx.fillRect(x - w / 2, y - postH - h, w, h);
    
    // Outer white piping trim
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.strokeRect(x - w / 2 + 4, y - postH - h + 4, w - 8, h - 8);

    // Typography Clean Font
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(6, Math.floor(12 * scale))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText((index % 2 === 0) ? "WEST Interstate 80" : "EXIT 24 A", x, y - postH - h + h * 0.35);
    
    ctx.font = `${Math.max(5, Math.floor(10 * scale))}px sans-serif`;
    ctx.fillText((index % 2 === 0) ? "1 MILE" : "KEEP RIGHT", x, y - postH - h + h * 0.7);
}

// --- Realistic Procedural Generation Setup ---
let segments = [];
function createTrack() {
    segments = [];
    for (let i = 0; i < TRACK_LENGTH; i++) {
        // Natural gradual smooth curves
        let curve = 0;
        if (i > 60 && i < 160) curve = 1.2;
        if (i > 240 && i < 340) curve = -1.8;
        if (i > 450 && i < 600) curve = 2.5;
        if (i > 750 && i < 900) curve = -1.5;

        // Smooth elevation rolling hills
        let worldY = 0;
        if (i > 150 && i < 350) worldY = Math.sin(((i - 150) / 200) * Math.PI) * 700; 
        if (i > 500 && i < 750) worldY = Math.sin(((i - 500) / 250) * Math.PI) * -500; 
        if (i > 850 && i < 1100) worldY = Math.sin(((i - 850) / 250) * Math.PI) * 900; 

        let sprite = null;
        if (i % 6 === 0) {
            sprite = { type: 'tree', side: (Math.random() > 0.5 ? 1.7 : -1.7) };
        } else if (i % 31 === 0) {
            sprite = { type: 'sign', side: 1.8 }; // Standard right shoulder safety signs
        }

        let isRumbleEven = Math.floor(i / RUMBLE_LENGTH) % 2 === 0;
        let isLaneEven = i % 2 === 0;

        segments.push({
            index: i,
            p1: { world: { x: 0, y: worldY, z: i * SEGMENT_LENGTH }, screen: { x: 0, y: 0, w: 0 } },
            p2: { world: { x: 0, y: worldY, z: (i + 1) * SEGMENT_LENGTH }, screen: { x: 0, y: 0, w: 0 } },
            curve: curve,
            sprite: sprite,
            color: {
                road: '#2c3e50', // Matte realistic deep asphalt dark gray
                grass: isRumbleEven ? '#27ae60' : '#219653', // Natural earthy fields 
                rumble: '#7f8c8d', // Asphalt standard concrete edge shoulder lines
                lane: isLaneEven ? '#ffffff' : 'transparent', 
                yellowLine: '#f1c40f' // Solid left yellow safety divider
            }
        });
    }

    for (let i = 1; i < TRACK_LENGTH; i++) {
        segments[i].p1.world.y = segments[i-1].p2.world.y;
    }
}

let cars = [];
const REALISTIC_CAR_COLORS = ["#34495e", "#7f8c8d", "#c0392b", "#2c3e50", "#d35400", "#16a085", "#f39c12", "#bdc3c7"];

function spawnCars() {
    cars = [];
    for (let i = 40; i < TRACK_LENGTH - 40; i += 18) {
        cars.push({
            z: i * SEGMENT_LENGTH,        
            laneX: (Math.random() * 1.6) - 0.8, // Distributed properly across highway lanes       
            speed: maxSpeed * 0.5 + (Math.random() * maxSpeed * 0.25), 
            color: REALISTIC_CAR_COLORS[Math.floor(Math.random() * REALISTIC_CAR_COLORS.length)],
            w: 450                                     
        });
    }
}

// --- Linear Matrix Matrix Transformations ---
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

    if (fogDensity > 0) {
        // Natural dusty horizontal fog blending
        ctx.fillStyle = `rgba(230, 126, 34, ${fogDensity * 0.85})`; 
        ctx.beginPath();
        ctx.moveTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x1 + w1, y1);
        ctx.closePath();
        ctx.fill();
    }
}

function drawRealisticCar(x, y, width, height, baseColor, isPlayer = false, rollLean = 0) {
    if (!ctx) return;
    if (width < 10) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(x - width / 2, y - height, width, height);
        return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rollLean); 

    let wheelW = width * 0.18;
    let wheelH = height * 0.42;
    let cabinW = width * 0.78;
    let cabinH = height * 0.52;

    // Under-body Shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(-width * 0.55, -wheelH * 0.5, width * 1.1, wheelH * 0.6);

    // Rubber Tires
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(-width / 2, -wheelH, wheelW, wheelH); 
    ctx.fillRect(width / 2 - wheelW, -wheelH, wheelW, wheelH); 

    // Main Chassis Body
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(-width / 2, -wheelH * 0.3);
    ctx.lineTo(-width / 2 + 2, -height * 0.5);
    ctx.lineTo(-cabinW / 2, -height * 0.5);
    ctx.lineTo(-cabinW * 0.4, -height);
    ctx.lineTo(cabinW * 0.4, -height);
    ctx.lineTo(cabinW / 2, -height * 0.5);
    ctx.lineTo(width / 2 - 2, -height * 0.5);
    ctx.lineTo(width / 2, -wheelH * 0.3);
    ctx.closePath();
    ctx.fill();

    // Windshield Reflection Tint
    ctx.fillStyle = "rgba(32, 40, 50, 0.85)";
    ctx.beginPath();
    ctx.moveTo(-cabinW * 0.38, -height * 0.52);
    ctx.lineTo(-cabinW * 0.28, -height + 4);
    ctx.lineTo(cabinW * 0.28, -height + 4);
    ctx.lineTo(cabinW * 0.38, -height * 0.52);
    ctx.closePath();
    ctx.fill();

    // High fidelity realistic brake lighting matrices
    if (isPlayer && (keys['ArrowDown'] || keys['s'] || keys['S'])) {
        ctx.fillStyle = "#ff2222"; 
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ff0000";
    } else {
        ctx.fillStyle = "#b31919"; 
    }
    // Proportional slim rear light clusters
    ctx.fillRect(-width * 0.45, -height * 0.44, width * 0.18, height * 0.09);
    ctx.fillRect(width * 0.45 - (width * 0.18), -height * 0.44, width * 0.18, height * 0.09);
    
    // License Plate Node
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#f1c40f";
    ctx.fillRect(-width * 0.08, -height * 0.36, width * 0.16, height * 0.07);

    ctx.restore();
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
    chassisRoll = 0;
    createTrack();
    spawnCars();
}

createTrack();
spawnCars();

// --- Processing Computation Logic ---
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

    let airResistance = -0.000014 * (speed * speed); 
    let rollingFriction = -110;                      
    speed += (airResistance + rollingFriction) * dt;

    if (keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' ']) {
        let overlay = document.getElementById("over-screen");
        if (overlay && overlay.style.display !== "none") overlay.style.display = "none";
        speed += accel;
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        speed += breaking;
    }

    let speedRatio = (speed / maxSpeed);
    
    if (speedRatio > 0.1) {
        carBounceTimer += dt * (speedRatio * 24);
        screenShakeX = (Math.random() - 0.5) * (speedRatio * 1.5);
        screenShakeY = (Math.random() - 0.5) * (speedRatio * 0.9);
    } else {
        carBounceTimer = 0;
        screenShakeX = 0;
        screenShakeY = 0;
    }

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        playerX -= 0.038 * speedRatio;
        chassisRoll = Math.max(-0.04, chassisRoll - 0.18 * dt); 
        if(speed > 0 && currentSegment) {
            skyOffset += currentSegment.curve * 0.2 * speedRatio + 1.2;
        }
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        playerX += 0.038 * speedRatio;
        chassisRoll = Math.min(0.04, chassisRoll + 0.18 * dt);  
        if(speed > 0 && currentSegment) {
            skyOffset += currentSegment.curve * 0.2 * speedRatio - 1.2;
        }
    } else {
        chassisRoll *= Math.pow(0.004, dt); 
        if(speed > 0 && currentSegment && currentSegment.curve !== 0) {
            skyOffset += currentSegment.curve * 0.4 * speedRatio;
        }
    }

    if (currentSegment && speed > 0) {
        playerX -= currentSegment.curve * 0.02 * speedRatio;
    }

    // Road friction constraints
    if (playerX < -1.1 || playerX > 1.1) {
        if (speed > 2000) speed += breaking * 1.2 * dt;
    }

    if (playerX < -1.7) playerX = -1.7;
    if (playerX > 1.7) playerX = 1.7;
    if (speed < 0) speed = 0;
    if (speed > maxSpeed) speed = maxSpeed;

    if (speed > 100) {
        score += Math.floor(speed / 3200);
    }

    cars.forEach(car => {
        car.z += car.speed * dt;
        while (car.z >= trackTotalLength) car.z -= trackTotalLength;
        while (car.z < 0) car.z += trackTotalLength;

        let zDiff = Math.abs(position - car.z);
        if (zDiff < 240 || zDiff > trackTotalLength - 240) {
            let distanceX = Math.abs(playerX - car.laneX);
            if (distanceX < 0.44) {
                speed = 0;
                gameOver = true;
            }
        }
    });
}

// --- Graphical Render Engine Pipe ---
function render() {
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

    // 1. Photo-Realistic Sunset Sky Gradient Matrix
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
    skyGrad.addColorStop(0, "#1f2d3d");    // Upper atmosphere twilight blue
    skyGrad.addColorStop(0.45, "#cf6a1d"); // Mid-sky deep evening orange
    skyGrad.addColorStop(0.75, "#e67e22"); // Incandescent golden horizon glow
    skyGrad.addColorStop(1, "#f39c12");    // Bright low sun intensity
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

    // 2. Realistic Stratus Cloud Layout Layer
    ctx.fillStyle = "rgba(241, 196, 15, 0.15)";
    for (let c = 0; c < 4; c++) {
        let cloudX = ((c * 260) + (skyOffset * 0.15)) % (canvas.width + 200) - 100;
        ctx.beginPath();
        ctx.ellipse(cloudX, 80 + c * 20, 160, 12, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. Landscape Ground Fill Plane
    ctx.fillStyle = "#1e4620"; 
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    const trackTotalLength = TRACK_LENGTH * SEGMENT_LENGTH;
    
    let startSegIndex = Math.floor(position / SEGMENT_LENGTH) % TRACK_LENGTH;
    let baseSegment = segments[startSegIndex];
    
    if (!baseSegment) { ctx.restore(); return; }

    let cameraHeight = 1450 + baseSegment.p1.world.y; 

    let maxy = canvas.height;
    let xOffset = 0;
    let dx = -(baseSegment.curve * (position % SEGMENT_LENGTH / SEGMENT_LENGTH));

    let drawQueue = [];
    let maxDrawSegments = 160;

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

        let fogDensity = Math.pow((i / maxDrawSegments), 2.2);

        // Ground/Grass rendering matrix mapping
        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);
        
        // Soft sunset atmospheric scattering over terrain
        ctx.fillStyle = `rgba(230, 126, 34, ${fogDensity * 0.7})`;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);

        let shoulderW1 = p1.w * 0.08;
        let shoulderW2 = p2.w * 0.08;
        
        let centerDashW1 = p1.w * 0.012;
        let centerDashW2 = p2.w * 0.012;

        let yellowLineW1 = p1.w * 0.01;
        let yellowLineW2 = p2.w * 0.01;

        // Base Road Track Polygons
        drawPolygon(p1.x, p1.y, p1.w + shoulderW1, p2.x, p2.y, p2.w + shoulderW2, segment.color.rumble, fogDensity);
        drawPolygon(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, segment.color.road, fogDensity);
        
        // Center Dashed White Separation Lanes
        drawPolygon(p1.x, p1.y, centerDashW1, p2.x, p2.y, centerDashW2, segment.color.lane, fogDensity);
        
        // Left Edge Yellow Solid Safety Line Boundary Mapping
        drawPolygon(p1.x - p1.w * 0.96, p1.y, yellowLineW1, p2.x - p2.w * 0.96, p2.y, yellowLineW2, segment.color.yellowLine, fogDensity);

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

    // Loop 3B: Environments Scenery Sorting Pipeline
    for (let i = drawQueue.length - 1; i >= 0; i--) {
        let item = drawQueue[i];
        if (item.type === 'sprite') {
            if (item.spriteData.type === 'tree') {
                drawRealisticTree(ctx, item.screenX, item.screenY, item.scale * 4.6);
            } else if (item.spriteData.type === 'sign') {
                drawHighwaySign(ctx, item.screenX, item.screenY, item.scale * 4.2, item.index);
            }
        }
    }

    // Loop 3C: Highway Traffic Positioning Pipes
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
            let carH = carW * 0.52;

            let trafficBounce = Math.sin((car.z * 0.04)) * 0.5;
            drawRealisticCar(carX, carY + trafficBounce, carW, carH, car.color, false, 0);
        }
    }

    // 4. Primary Driver Car Layer Configuration
    let pCarW = 164;
    let pCarH = 84;
    let pCarX = canvas.width / 2;
    
    let pCarBounce = (speed > 0) ? Math.sin(carBounceTimer) * 1.1 : 0;
    let pCarY = (canvas.height - 30) + pCarBounce;
    
    // Sleek metallic graphite gray finish for player vehicle
    drawRealisticCar(pCarX, pCarY, pCarW, pCarH, "#4b5563", true, chassisRoll);

    // 5. Game Over Prompt Overlay Interception Matrix
    if (gameOver) {
        ctx.fillStyle = "rgba(10, 15, 20, 0.9)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("COLLISION DETECTED", canvas.width / 2, canvas.height / 2 - 15);
        
        ctx.fillStyle = "#94a3b8";
        ctx.font = "16px sans-serif";
        ctx.fillText(`DRIVING DISTANCE SCORE: ${score} | Press SPACEBAR to restart`, canvas.width / 2, canvas.height / 2 + 30);
    }

    ctx.restore(); 
}

// --- Frame Tick Iteration Engine ---
let lastTime = performance.now();
function gameLoop() {
    try {
        let now = performance.now();
        let dt = Math.min(0.1, (now - lastTime) / 1000); 
        lastTime = now;

        update(dt);
        render();
    } catch (e) {
        // Fallback protection state loop
    }
    requestAnimationFrame(gameLoop);
}

gameLoop();
gameLoop();
