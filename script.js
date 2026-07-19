const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');
const speedVal = document.getElementById('speed-val');

canvas.width = 600;
canvas.height = 450;

// Game Systems
let gameOver = false;
let score = 0;
let distanceTraveled = 0;
let speed = 0;
const maxSpeed = 160;

// Track Geometry Environment
let trackPosition = 0;
let curveMagnitude = 0;
let currentCurve = 0;
let targetCurve = 0;
let curveTimer = 0;

// Player Asset Design
const player = {
    x: 0, // Relative centerview offset (-1 to 1)
    y: 0,
    width: 90,
    height: 45
};

// Traffic State Manager
let traffic = [];
const trafficColors = ['#ff0066', '#9d00ff', '#ff9900', '#ffff00'];

function spawnVehicle() {
    if (gameOver) return;
    if (traffic.length < 4 && Math.random() < 0.4) {
        traffic.push({
            lane: Math.floor(Math.random() * 3) - 1, // -1 (Left), 0 (Center), 1 (Right)
            z: 2.0, // Distance on horizon pipeline
            color: trafficColors[Math.floor(Math.random() * trafficColors.length)],
            speed: 0.015 + (Math.random() * 0.01)
        });
    }
}
let trafficSpawner = setInterval(spawnVehicle, 1200);

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (gameOver && (e.code === 'Space' || e.code === 'Enter')) resetGame();
});
window.addEventListener('keyup', e => keys[e.code] = false);

function resetGame() {
    gameOver = false;
    score = 0;
    distanceTraveled = 0;
    speed = 0;
    trackPosition = 0;
    curveMagnitude = 0;
    currentCurve = 0;
    player.x = 0;
    traffic = [];
    if (scoreVal) scoreVal.innerText = score;
    if (speedVal) speedVal.innerText = speed;
}

function gameLoop() {
    // 1. UPDATE LOGIC ENGINE
    if (!gameOver) {
        // Driving Input Calculations
        if (keys['ArrowUp'] || keys['KeyW']) {
            speed = Math.min(speed + 1.5, maxSpeed);
        } else {
            speed = Math.max(speed - 2, 0);
        }

        if (speed > 0) {
            if (keys['ArrowLeft'] || keys['KeyA']) player.x -= 0.04 * (speed / maxSpeed + 0.3);
            if (keys['ArrowRight'] || keys['KeyD']) player.x += 0.04 * (speed / maxSpeed + 0.3);
            
            // Apply track curve force physics to drag player away
            player.x -= currentCurve * 0.00015 * speed;
        }

        // Clip player limits inside boundary limits
        if (player.x < -1.4) player.x = -1.4;
        if (player.x > 1.4) player.x = 1.4;

        // Dynamic Procedural Curve Adjustments
        curveTimer -= 1;
        if (curveTimer <= 0) {
            targetCurve = (Math.random() * 2 - 1) * 4; 
            curveTimer = 80 + Math.random() * 100;
        }
        currentCurve += (targetCurve - currentCurve) * 0.04;

        distanceTraveled += speed * 0.05;
        trackPosition += speed * 0.05;
        
        score = Math.floor(distanceTraveled / 10);
        if (scoreVal) scoreVal.innerText = score;
        if (speedVal) speedVal.innerText = Math.floor(speed);

        // Process Traffic Array Pipeline
        for (let i = traffic.length - 1; i >= 0; i--) {
            let car = traffic[i];
            // Approach perspective camera vector
            car.z -= (speed / maxSpeed) * 0.03 - car.speed;

            // Collision Vector Processing Threshold
            if (car.z <= 0.15 && car.z > 0.05) {
                const playerLane = player.x < -0.4 ? -1 : (player.x > 0.4 ? 1 : 0);
                if (playerLane === car.lane) {
                    gameOver = true;
                    speed = 0;
                }
            }

            // Recycle offscreen assets
            if (car.z <= 0.02) {
                traffic.splice(i, 1);
            }
        }
    }

    // 2. GRAPHICS RENDERING PIPELINE
    ctx.fillStyle = '#050010';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render Synthwave Retro Sunset Horizon Layer
    let horizonY = 160;
    let gradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    gradient.addColorStop(0, '#7000ff');
    gradient.addColorStop(0.4, '#ff0066');
    gradient.addColorStop(0.7, '#ff6600');
    gradient.addColorStop(1, '#ffcc00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, horizonY);

    // Sun rendering asset
    ctx.beginPath();
    ctx.arc(canvas.width / 2, horizonY, 55, Math.PI, 0, false);
    let sunGrad = ctx.createLinearGradient(0, horizonY - 55, 0, horizonY);
    sunGrad.addColorStop(0, '#ffff00');
    sunGrad.addColorStop(1, '#ff0066');
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Horizon Distant Mountains Rendering Outlines
    ctx.fillStyle = '#14052b';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(120, horizonY - 25); ctx.lineTo(220, horizonY);
    ctx.lineTo(380, horizonY - 35); ctx.lineTo(480, horizonY);
    ctx.lineTo(600, horizonY - 15); ctx.lineTo(600, horizonY);
    ctx.fill();

    // 3D Perspective Pseudo Projection Grid Calculations
    let scanlines = 28;
    for (let i = 0; i < scanlines; i++) {
        let perspectivePercent = i / scanlines;
        let y = horizonY + (canvas.height - horizonY) * Math.pow(perspectivePercent, 2.2);
        let nextY = horizonY + (canvas.height - horizonY) * Math.pow((i + 1) / scanlines, 2.2);
        
        let roadWidthPercent = 0.1 + 0.75 * Math.pow(perspectivePercent, 2);
        let nextRoadWidthPercent = 0.1 + 0.75 * Math.pow((i + 1) / scanlines, 2);
        
        let curveOffset = Math.sin((y + trackPosition) * 0.004) * currentCurve * (1 - perspectivePercent);
        let nextCurveOffset = Math.sin((nextY + trackPosition) * 0.004) * currentCurve * (1 - ((i + 1) / scanlines));

        let centerX = canvas.width / 2 + curveOffset;
        let nextCenterX = canvas.width / 2 + nextCurveOffset;

        let w = canvas.width * roadWidthPercent;
        let nextW = canvas.width * nextRoadWidthPercent;

        // Render Ground Grass Segments (Alternating Synthwave Grid lines)
        let groundColor = (Math.floor(y + trackPosition * 0.6) % 50 < 25) ? '#10002b' : '#1a003c';
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, y, canvas.width, nextY - y);

        // Main Highway Segment Processing
        ctx.fillStyle = '#221838';
        ctx.beginPath();
        ctx.moveTo(centerX - w / 2, y);
        ctx.lineTo(nextCenterX - nextW / 2, nextY);
        ctx.lineTo(nextCenterX + nextW / 2, nextY);
        ctx.lineTo(centerX + w / 2, y);
        ctx.fill();

        // Rumble Strips Edging Borders
        let rumbleColor = (Math.floor(y + trackPosition * 0.9) % 40 < 20) ? '#ff0066' : '#ffffff';
        ctx.fillStyle = rumbleColor;
        let rW = w * 0.05;
        let nextRW = nextW * 0.05;
        
        // Left rumble strip
        ctx.beginPath();
        ctx.moveTo(centerX - w / 2, y); ctx.lineTo(nextCenterX - nextW / 2, nextY);
        ctx.lineTo(nextCenterX - nextW / 2 + nextRW, nextY); ctx.lineTo(centerX - w / 2 + rW, y);
        ctx.fill();
        // Right rumble strip
        ctx.beginPath();
        ctx.moveTo(centerX + w / 2, y); ctx.lineTo(nextCenterX + nextW / 2, nextY);
        ctx.lineTo(nextCenterX + nextW / 2 - nextRW, nextY); ctx.lineTo(centerX + w / 2 - rW, y);
        ctx.fill();

        // White Center Dashboard Dividers
        if (Math.floor(y + trackPosition * 1.2) % 60 < 30) {
            ctx.fillStyle = '#ffffff';
            let cW = w * 0.02;
            let nextCW = nextW * 0.02;
            ctx.beginPath();
            ctx.moveTo(centerX - cW / 2, y); ctx.lineTo(nextCenterX - nextCW / 2, nextY);
            ctx.lineTo(nextCenterX + nextCW / 2, nextY); ctx.lineTo(centerX + cW / 2, y);
            ctx.fill();
        }
    }

    // Render Approaching Traffic Matrix Elements
    traffic.forEach(car => {
        if (car.z <= 0.05 || car.z > 1.8) return;

        // Calculate perspective placement maps
        let rawP = (1.8 - car.z) / 1.8; 
        let p = Math.pow(rawP, 2.5); 

        let y = horizonY + (canvas.height - horizonY) * p;
        let scale = 0.08 + 0.82 * Math.pow(p, 2);
        
        let curveOffset = Math.sin((y + trackPosition) * 0.004) * currentCurve * (1 - p);
        let roadW = canvas.width * (0.1 + 0.75 * Math.pow(p, 2));
        
        // Dynamic position mapping inside target lanes
        let laneOffset = (car.lane * roadW * 0.3);
        let x = canvas.width / 2 + curveOffset + laneOffset;

        let carW = 55 * scale;
        let carH = 30 * scale;

        // Base vehicle asset styling matrix
        ctx.fillStyle = car.color;
        ctx.fillRect(x - carW / 2, y - carH, carW, carH);
        
        // Taillights
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x - carW / 2 + 2, y - carH + 2, carW * 0.2, carH * 0.2);
        ctx.fillRect(x + carW / 2 - (carW * 0.2) - 2, y - carH + 2, carW * 0.2, carH * 0.2);
    });

    // Render Player Asset Spacecraft Car Setup
    let pX = canvas.width / 2 + (player.x * (canvas.width * 0.28));
    let pY = canvas.height - 30;

    // Body chassis outline mapping
    ctx.fillStyle = '#00ffff'; 
    ctx.fillRect(pX - player.width / 2, pY - player.height, player.width, player.height);
    
    // Windshield frame
    ctx.fillStyle = '#111122';
    ctx.fillRect(pX - player.width * 0.35, pY - player.height + 5, player.width * 0.7, player.height * 0.4);
    
    // Brakelights asset processing
    ctx.fillStyle = (speed > 0 && !(keys['ArrowUp'] || keys['KeyW'])) ? '#ff0033' : '#660011';
    ctx.fillRect(pX - player.width / 2 + 5, pY - 12, 18, 6);
    ctx.fillRect(pX + player.width / 2 - 23, pY - 12, 18, 6);
    
    // Spoiler layout wings
    ctx.fillStyle = '#0088cc';
    ctx.fillRect(pX - player.width * 0.55, pY - player.height - 4, player.width * 1.1, 5);

    // Game Over Text Elements
    if (gameOver) {
        ctx.fillStyle = 'rgba(10, 2, 20, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0066';
        ctx.font = 'bold 40px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('CRASHED', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#00ffff';
        ctx.font = '16px Courier New';
        ctx.fillText('PRESS SPACEBAR TO RACE AGAIN', canvas.width / 2, canvas.height / 2 + 30);
        ctx.textAlign = 'left';
    }

    requestAnimationFrame(gameLoop);
}

// Kick off initialization sequence
gameLoop();
