const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');
const speedVal = document.getElementById('speed-val');
const overlay = document.getElementById('over-screen');
const mainTitle = document.getElementById('main-title');
const subTitle = document.getElementById('sub-title');

// Match inner canvas resolution to screen frame aspect ratio
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Engine Architecture Parameters
let gameActive = false;
let gameOver = false;
let score = 0;
let distance = 0;
let speed = 0;
const maxSpeed = 220;

let trackPosition = 0;
let playerX = 0; // Centerline position map: -1.0 to 1.0
let skyOffset = 0;

// Track Segments Array
const segments = [];
const segmentLength = 200;
const roadWidth = 1200;
const horizonRatio = 0.45; // Fixed camera horizon split point

// Create structural highway path loop
for (let i = 0; i < 600; i++) {
    let curve = 0;
    if (i > 60 && i < 140) curve = 2.0;   // Hard right bend
    if (i > 180 && i < 260) curve = -2.5; // Left sweep
    if (i > 340 && i < 420) curve = 4.0;  // Sharp spiral curve
    if (i > 460 && i < 540) curve = -1.5;

    segments.push({
        index: i,
        z1: i * segmentLength,
        z2: (i + 1) * segmentLength,
        curve: curve,
        roadColor: (Math.floor(i / 3) % 2) ? '#1b122c' : '#231838',
        rumbleColor: (Math.floor(i / 3) % 2) ? '#ff0055' : '#ffffff',
        gridColor: (Math.floor(i / 3) % 2) ? '#05010a' : '#0a0314'
    });
}
const trackLength = segments.length * segmentLength;

// Traffic Structure Arrays
let traffic = [];
const carColors = ['#ff0055', '#9d00ff', '#ff9900', '#00ff66', '#ffff00'];

function populateTraffic() {
    traffic = [];
    // Space out 35 high-speed target cars evenly along track length
    for (let i = 0; i < 35; i++) {
        traffic.push({
            baseZ: Math.random() * (trackLength - 3000) + 2000,
            currentZ: 0,
            laneOffset: (Math.random() * 2 - 1) * 0.65, // Lock inside proper lanes
            speed: 70 + Math.random() * 50, // Active target tracking speed
            color: carColors[Math.floor(Math.random() * carColors.length)]
        });
    }
}

// 3D Matrix Mathematical Perspective Mapping
function project3D(worldX, worldY, worldZ, cameraX, cameraY, cameraZ, camDepth, width, height) {
    let transX = worldX - cameraX;
    let transY = worldY - cameraY;
    let transZ = worldZ - cameraZ;

    if (transZ <= 0) return null;

    let scale = camDepth / transZ;
    return {
        x: Math.round((width / 2) + (scale * transX * width / 2)),
        y: Math.round((height * horizonRatio) - (scale * transY * height / 2)),
        w: Math.round(scale * roadWidth * width / 2)
    };
}

// Inputs Core Setup
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') {
        if (!gameActive || gameOver) restartGame();
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

function restartGame() {
    gameOver = false;
    gameActive = true;
    score = 0;
    distance = 0;
    speed = 0;
    trackPosition = 0;
    playerX = 0;
    skyOffset = 0;
    populateTraffic();
    overlay.style.opacity = 0;
    setTimeout(() => overlay.style.visibility = 'hidden', 300);
}

function triggerCrash() {
    gameOver = true;
    gameActive = false;
    speed = 0;
    mainTitle.innerText = "CRASHED";
    subTitle.innerText = "PRESS ENTER TO RACE AGAIN";
    overlay.style.visibility = 'visible';
    overlay.style.opacity = 1;
}

// ========================================================
// CORE RUNTIME ENGINE LOOP
// ========================================================
let lastFrameTime = performance.now();

function stepEngine() {
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1); // Cap timestep lag jumps
    lastFrameTime = now;

    const horizonY = canvas.height * horizonRatio;

    if (gameActive && !gameOver) {
        // Driving Input Translations
        if (keys['ArrowUp'] || keys['KeyW']) speed = Math.min(speed + 120 * dt, maxSpeed);
        else if (keys['ArrowDown'] || keys['KeyS']) speed = Math.max(speed - 180 * dt, 0);
        else speed = Math.max(speed - 45 * dt, 0);

        // Responsive Anti-Slide Handling Matrix
        if (speed > 0) {
            const steerSpeed = 1.6 * dt * (speed / maxSpeed + 0.2);
            if (keys['ArrowLeft'] || keys['KeyA']) playerX -= steerSpeed;
            else if (keys['ArrowRight'] || keys['KeyD']) playerX += steerSpeed;
            else {
                // ACTIVE HANDLING FIX: Snap center vector to counter drifting
                playerX -= playerX * 6.0 * dt; 
                if (Math.abs(playerX) < 0.005) playerX = 0;
            }
        }

        // Apply environment track curvature torque calculation
        const currentSegIndex = Math.floor(trackPosition / segmentLength) % segments.length;
        const currentSeg = segments[currentSegIndex];
        playerX -= currentSeg.curve * 0.04 * dt * (speed / maxSpeed);

        // Bind layout limits to asphalt edge markers
        if (playerX < -1.6) playerX = -1.6;
        if (playerX > 1.6) playerX = 1.6;

        // Advance pipeline displacement tracking maps
        trackPosition += speed * 4.5 * dt;
        if (trackPosition >= trackLength) trackPosition -= trackLength;

        distance += speed * dt * 0.08;
        score = Math.floor(distance);

        skyOffset -= currentSeg.curve * 0.03 * (speed / maxSpeed);

        scoreVal.innerText = score;
        speedVal.innerText = Math.floor(speed);
    }

    // ----------------------------------------------------
    // RENDERING PIPELINE
    // ----------------------------------------------------
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render Retro Synthwave Dual Layer Moving Sky Grid
    let skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0, '#310066');
    skyGradient.addColorStop(0.5, '#bd005a');
    skyGradient.addColorStop(1, '#ff5500');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, horizonY);

    // Neon Grid Stars Pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let s = 0; s < 40; s++) {
        let starX = (Math.sin(s * 99) * canvas.width * 2 + skyOffset * 400) % canvas.width;
        if (starX < 0) starX += canvas.width;
        let starY = (Math.cos(s * 45) * 0.5 + 0.5) * (horizonY - 20);
        ctx.fillRect(starX, starY, 2, 2);
    }

    // Camera Constants Projection Definitions
    const camHeight = 900;
    const camDepth = 1 / Math.tan((80 / 2) * Math.PI / 180);
    const startSegment = Math.floor(trackPosition / segmentLength);
    const playerCamX = playerX * roadWidth;

    let currentMaxY = canvas.height;
    let segmentCurveSum = 0;
    let segmentCurveDelta = 0;

    // Scan backwards from perspective limits (Horizon -> Screen Floor)
    const renderHorizonDepth = 140;
    const renderSegments = [];

    for (let n = 0; n < renderHorizonDepth; n++) {
        let sIndex = (startSegment + n) % segments.length;
        let seg = segments[sIndex];
        let loopOffset = (sIndex < startSegment) ? trackLength : 0;

        segmentCurveDelta += seg.curve;
        segmentCurveSum += segmentCurveDelta;

        let p1 = project3D(segmentCurveSum - segmentCurveDelta, camHeight, seg.z1 + loopOffset, playerCamX, camHeight, trackPosition, camDepth, canvas.width, canvas.height);
        let p2 = project3D(segmentCurveSum, camHeight, seg.z2 + loopOffset, playerCamX, camHeight, trackPosition, camDepth, canvas.width, canvas.height);

        if (!p1 || !p2 || p2.y >= p1.y || p1.y < horizonY) continue;

        renderSegments[n] = { p1, p2, seg, n };
    }

    // Render background elements forward to preserve proper Z-layer stacking
    for (let n = renderHorizonDepth - 1; n >= 0; n--) {
        if (!renderSegments[n]) continue;
        let { p1, p2, seg } = renderSegments[n];

        if (p1.y >= currentMaxY) continue;

        // Terrain Grass Grid Layers
        ctx.fillStyle = seg.gridColor;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);

        // Outer Shoulders Rumble Lines Matrix
        ctx.fillStyle = seg.rumbleColor;
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w * 1.12, p1.y); ctx.lineTo(p2.x - p2.w * 1.12, p2.y);
        ctx.lineTo(p2.x + p2.w * 1.12, p2.y); ctx.lineTo(p1.x + p1.w * 1.12, p1.y);
        ctx.fill();

        // Asphalt Track Highway Surface
        ctx.fillStyle = seg.roadColor;
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w, p1.y); ctx.lineTo(p2.x - p2.w, p2.y);
        ctx.lineTo(p2.x + p2.w, p2.y); ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.fill();

        // White Center Dash Dividers Configuration
        if (seg.index % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(p1.x - p1.w * 0.015, p1.y); ctx.lineTo(p2.x - p2.w * 0.015, p2.y);
            ctx.lineTo(p2.x + p2.w * 0.015, p2.y); ctx.lineTo(p1.x + p1.w * 0.015, p1.y);
            ctx.fill();
        }
    }

    // ----------------------------------------------------
    // TRAFFIC ASSET RENDER MAPS
    // ----------------------------------------------------
    traffic.forEach(car => {
        car.currentZ = car.baseZ;
        let relativeZ = car.currentZ - trackPosition;
        if (relativeZ < -segmentLength) relativeZ += trackLength;
        if (relativeZ > trackLength - segmentLength) relativeZ -= trackLength;

        // Drive target algorithm movement updates
        if (gameActive && !gameOver) {
            car.baseZ += car.speed * 4.5 * dt;
            if (car.baseZ >= trackLength) car.baseZ -= trackLength;
        }

        if (relativeZ <= 0 || relativeZ > renderHorizonDepth * segmentLength) return;

        let carSegIndex = Math.floor(car.currentZ / segmentLength) % segments.length;
        
        // Calculate procedural curve accumulator matrix path displacement up to car location
        let curveAccumulator = 0;
        let deltaAccumulator = 0;
        let stepsAhead = (carSegIndex - startSegment + segments.length) % segments.length;
        
        for (let k = 0; k < stepsAhead && k < renderHorizonDepth; k++) {
            let idx = (startSegment + k) % segments.length;
            deltaAccumulator += segments[idx].curve;
            curveAccumulator += deltaAccumulator;
        }

        let scale = camDepth / relativeZ;
        let carWorldX = curveAccumulator + (car.laneOffset * roadWidth);
        let screenPos = project3D(carWorldX, camHeight, car.currentZ, playerCamX, camHeight, trackPosition, camDepth, canvas.width, canvas.height);

        if (!screenPos || screenPos.y < horizonY) return;

        let scaleW = screenPos.w * 0.24;
        let scaleH = scaleW * 0.55;

        // Core Collision Box Interceptor Vector
        if (relativeZ < 140 && relativeZ > 20) {
            let laneWidthMap = 0.45;
            if (Math.abs(playerX - car.laneOffset) < laneWidthMap) {
                triggerCrash();
            }
        }

        // Draw Approaching Enemy Vehicle Model
        ctx.fillStyle = car.color;
        ctx.fillRect(screenPos.x - scaleW / 2, screenPos.y - scaleH, scaleW, scaleH);

        // Canopy Windows
        ctx.fillStyle = '#06010f';
        ctx.fillRect(screenPos.x - scaleW * 0.35, screenPos.y - scaleH + (scaleH * 0.1), scaleW * 0.7, scaleH * 0.35);

        // Glowing Taillights Matrix
        ctx.fillStyle = '#ff0033';
        ctx.fillRect(screenPos.x - scaleW * 0.45, screenPos.y - scaleH * 0.4, scaleW * 0.18, scaleH * 0.2);
        ctx.fillRect(screenPos.x + scaleW * 0.27, screenPos.y - scaleH * 0.4, scaleW * 0.18, scaleH * 0.2);
    });

    // ----------------------------------------------------
    // PLAYER ENGINE SPRITE DRAWING
    // ----------------------------------------------------
    const playerWidth = 125;
    const playerHeight = 65;
    const playerDrawX = canvas.width / 2;
    const playerDrawY = canvas.height - 40;

    // Outer Body Aero Chassis Styling
    ctx.fillStyle = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffff';
    ctx.fillRect(playerDrawX - playerWidth / 2, playerDrawY - playerHeight, playerWidth, playerHeight);
    ctx.shadowBlur = 0; // Reset canvas filter buffers

    // Windshield frame
    ctx.fillStyle = '#0a0314';
    ctx.fillRect(playerDrawX - playerWidth * 0.34, playerDrawY - playerHeight + 10, playerWidth * 0.68, playerHeight * 0.38);

    // Active Performance Afterburner Lights Array
    ctx.fillStyle = (speed > 0 && keys['ArrowDown']) ? '#ff0055' : '#770022';
    if (speed > 0 && keys['ArrowDown']) ctx.shadowBlur = 10, ctx.shadowColor = '#ff0055';
    ctx.fillRect(playerDrawX - playerWidth / 2 + 12, playerDrawY - 14, 26, 8);
    ctx.fillRect(playerDrawX + playerWidth / 2 - 38, playerDrawY - 14, 26, 8);
    ctx.shadowBlur = 0;

    // Cyberpunk Wing Spoiler Assembly
    ctx.fillStyle = '#310066';
    ctx.fillRect(playerDrawX - playerWidth * 0.54, playerDrawY - playerHeight - 4, playerWidth * 1.08, 6);

    requestAnimationFrame(stepEngine);
}

// Fire Up Engine Initial Run Sequence
stepEngine();
