const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');

// Engine Aspect Configuration
canvas.width = 440;
canvas.height = 620;

// Game Operational States
let gameOver = false;
let score = 0;
let speedModifier = 1;

// Player Entity (Cyan Car)
const player = {
    x: 195,
    y: 510,
    width: 46,
    height: 76,
    speed: 6,
    color: '#00ffff'
};

// Traffic Layer Configuration
const trafficColors = ['#ff0066', '#ff3300', '#9d00ff', '#ff9900'];
let trafficCars = [];

function spawnTraffic() {
    if (gameOver) return;
    
    // 3 Distinct Lanes balanced for the canvas width
    const lanes = [65, 195, 325];
    const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
    
    const tooClose = trafficCars.some(car => car.y < 160 && car.x === randomLane);
    
    if (!tooClose) {
        trafficCars.push({
            x: randomLane,
            y: -90,
            width: 46,
            height: 76,
            speed: (Math.random() * 2.5 + 3.5) * speedModifier,
            color: trafficColors[Math.floor(Math.random() * trafficColors.length)]
        });
    }
}

let spawnInterval = setInterval(spawnTraffic, 1400);

// Key Interception Array
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (gameOver && (e.code === 'Space' || e.code === 'Enter')) {
        resetGame();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function checkCollision(rect1, rect2) {
    const padding = 4; // Inside border padding for close-call forgiveness
    return rect1.x + padding < rect2.x + rect2.width - padding &&
           rect1.x + rect1.width - padding > rect2.x + padding &&
           rect1.y + padding < rect2.y + rect2.height - padding &&
           rect1.y + rect1.height - padding > rect2.y + padding;
}

function resetGame() {
    gameOver = false;
    score = 0;
    speedModifier = 1;
    player.x = 195;
    player.y = 510;
    trafficCars = [];
    if (scoreVal) scoreVal.innerText = score;
    
    clearInterval(spawnInterval);
    spawnInterval = setInterval(spawnTraffic, 1400);
}

// Engine Core Pipeline Loop
function gameLoop() {
    // Background render layer
    ctx.fillStyle = '#140226'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Segmented highway striping
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.setLineDash([25, 25]);
    ctx.beginPath();
    ctx.moveTo(146, 0); ctx.lineTo(146, canvas.height);
    ctx.moveTo(292, 0); ctx.lineTo(292, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]); 

    if (!gameOver) {
        // Player translation vector calculation
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
        if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed;
        if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed;
        
        // Boundaries restriction
        if (player.x < 20) player.x = 20;
        if (player.x > canvas.width - player.width - 20) player.x = canvas.width - player.width - 20;
        if (player.y < 0) player.y = 0;
        if (player.y > canvas.height - player.height) player.y = canvas.height - player.height;

        speedModifier = 1 + (score * 0.04);

        // Update traffic matrix arrays
        for (let i = trafficCars.length - 1; i >= 0; i--) {
            let car = trafficCars[i];
            car.y += car.speed;
            
            ctx.fillStyle = car.color;
            ctx.fillRect(car.x, car.y, car.width, car.height);
            
            if (checkCollision(player, car)) {
                gameOver = true;
            }
            
            if (car.y > canvas.height) {
                trafficCars.splice(i, 1);
                score += 1;
                if (scoreVal) scoreVal.innerText = score;
            }
        }
    } else {
        trafficCars.forEach(car => {
            ctx.fillStyle = car.color;
            ctx.fillRect(car.x, car.y, car.width, car.height);
        });
    }

    // Render active player asset
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Dynamic overlay for end states
    if (gameOver) {
        ctx.fillStyle = 'rgba(15, 3, 31, 0.82)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0066'; 
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CRASHED!', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#00ffff'; 
        ctx.font = '16px sans-serif';
        ctx.fillText('Press SPACEBAR or ENTER to try again', canvas.width / 2, canvas.height / 2 + 25);
        ctx.textAlign = 'left'; 
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
