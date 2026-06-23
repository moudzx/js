document.addEventListener("click", () => {
    document.getElementById("bgm").play();
}, { once: true });

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function randomBetween(min = 0, max = 1) {
    return Math.random() * (max - min) + min;
}

const randomAngle = () => randomBetween(0, 2 * Math.PI);

class Color {
    constructor(r, g, b, a) {
        this.r = r; this.g = g; this.b = b; this.a = a;
    }

    toRgba() {
        return `rgba(${this.r * 255}, ${this.g * 255}, ${this.b * 255}, ${this.a})`;
    }

    withAlpha(a) {
        return new Color(this.r, this.g, this.b, a);
    }

    grayScale(t = 1.0) {
        let x = (this.r + this.g + this.b) / 3;
        return new Color(lerp(this.r, x, t), lerp(this.g, x, t), lerp(this.b, x, t), this.a);
    }

    static hex(hexcolor) {
        let matches = hexcolor.match(/#([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})/i);
        if (matches) {
            let [, r, g, b] = matches;
            return new Color(parseInt(r, 16) / 255.0, parseInt(g, 16) / 255.0, parseInt(b, 16) / 255.0, 1.0);
        }
        throw new Error(`Could not parse ${hexcolor} as color`);
    }
}

class V2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(that) { return new V2(this.x + that.x, this.y + that.y); }
    sub(that) { return new V2(this.x - that.x, this.y - that.y); }
    scale(s) { return new V2(this.x * s, this.y * s); }
    len() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    dist(that) { return this.sub(that).len(); }

    normalize() {
        const n = this.len();
        return n === 0 ? new V2(0, 0) : new V2(this.x / n, this.y / n);
    }

    static polar(mag, dir) {
        return new V2(Math.cos(dir) * mag, Math.sin(dir) * mag);
    }
}

class Renderer2D {
    cameraPos = new V2(0, 0);
    cameraVel = new V2(0, 0);
    grayness = 0.0;
    unitsPerPixel = 1.0;

    constructor(context2d) {
        this.context2d = context2d;
    }

    update(dt) {
        this.cameraPos = this.cameraPos.add(this.cameraVel.scale(dt));
    }

    width() { return this.context2d.canvas.width * this.unitsPerPixel; }
    height() { return this.context2d.canvas.height * this.unitsPerPixel; }

    getScreenWorldBounds() {
        let topLeft = this.screenToWorld(new V2(0, 0));
        let bottomRight = this.screenToWorld(new V2(this.context2d.canvas.width, this.context2d.canvas.height));
        return [topLeft, bottomRight];
    }

    screenToWorld(point) {
        const width = this.context2d.canvas.width;
        const height = this.context2d.canvas.height;
        return point.sub(new V2(width / 2, height / 2)).scale(this.unitsPerPixel).add(this.cameraPos);
    }

    worldToCamera(point) {
        const width = this.width();
        const height = this.height();
        return point.sub(this.cameraPos).add(new V2(width / 2, height / 2));
    }

    clear() {
        this.context2d.clearRect(0, 0, this.width(), this.height());
    }

    setTarget(target) {
        this.cameraVel = target.sub(this.cameraPos);
    }

    fillCircle(center, radius, color) {
        const screenCenter = this.worldToCamera(center);
        this.context2d.fillStyle = color.grayScale(this.grayness).toRgba();
        this.context2d.beginPath();
        this.context2d.arc(screenCenter.x, screenCenter.y, radius, 0, 2 * Math.PI, false);
        this.context2d.fill();
    }

    drawSun(center, radius, time) {
        const screenCenter = this.worldToCamera(center);
        this.context2d.save();
        
        const glowRadius = radius * (1.3 + Math.sin(time * 0.005) * 0.05);
        const grad = this.context2d.createRadialGradient(
            screenCenter.x, screenCenter.y, radius * 0.2,
            screenCenter.x, screenCenter.y, glowRadius
        );
        grad.addColorStop(0, '#ffffff'); 
        grad.addColorStop(0.2, '#fff4b8');
        grad.addColorStop(0.5, '#ffd700'); 
        grad.addColorStop(0.8, '#ff6a00'); 
        grad.addColorStop(1, 'rgba(255, 106, 0, 0)');

        this.context2d.fillStyle = grad;
        this.context2d.beginPath();
        this.context2d.arc(screenCenter.x, screenCenter.y, glowRadius, 0, 2 * Math.PI);
        this.context2d.fill();
        this.context2d.restore();
    }

    drawShadow(center, radius) {
        const screenCenter = this.worldToCamera(center);
        this.context2d.save();
        
        const shadowGrad = this.context2d.createRadialGradient(
            screenCenter.x, screenCenter.y, radius * 0.05,
            screenCenter.x, screenCenter.y, radius
        );
        shadowGrad.addColorStop(0, 'rgba(245, 245, 250, 0.95)'); 
        shadowGrad.addColorStop(0.25, 'rgba(180, 185, 200, 0.75)'); 
        shadowGrad.addColorStop(0.65, 'rgba(70, 70, 80, 0.45)'); 
        shadowGrad.addColorStop(0.9, 'rgba(40, 40, 45, 0.15)'); 
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.context2d.fillStyle = shadowGrad;
        this.context2d.beginPath();
        this.context2d.arc(screenCenter.x, screenCenter.y, radius, 0, 2 * Math.PI);
        this.context2d.fill();
        this.context2d.restore();
    }

    drawGradientBullet(center, radius, velocity) {
        const screenCenter = this.worldToCamera(center);
        this.context2d.save();

        const dir = velocity.normalize();
        const startPoint = screenCenter.sub(dir.scale(radius));
        const endPoint = screenCenter.add(dir.scale(radius));

        const bulletGrad = this.context2d.createLinearGradient(
            startPoint.x, startPoint.y,
            endPoint.x, endPoint.y
        );
        bulletGrad.addColorStop(0, '#ff1a1a'); 
        bulletGrad.addColorStop(0.5, '#ff7700'); 
        bulletGrad.addColorStop(1, '#ffd700'); 

        this.context2d.fillStyle = bulletGrad;
        this.context2d.beginPath();
        this.context2d.arc(screenCenter.x, screenCenter.y, radius, 0, 2 * Math.PI);
        this.context2d.fill();
        this.context2d.restore();
    }

    fillRect(x, y, w, h, color) {
        const screenPos = this.worldToCamera(new V2(x, y));
        this.context2d.fillStyle = color.grayScale(this.grayness).toRgba();
        this.context2d.fillRect(screenPos.x, screenPos.y, w, h);
    }

    fillMessage(text, color) {
        const width = this.width();
        const height = this.height();
        const FONT_SIZE = 69;
        const LINE_PADDING = 69;
        this.context2d.fillStyle = color.toRgba();
        this.context2d.font = `bold ${FONT_SIZE}px sans-serif`;
        this.context2d.textAlign = "center";
        this.context2d.textBaseline = "middle";
        const lines = text.split("\n");
        const MESSAGE_HEIGTH = (FONT_SIZE + LINE_PADDING) * (lines.length - 1);
        for (let i = 0; i < lines.length; ++i) {
            this.context2d.fillText(lines[i], width / 2, (height - MESSAGE_HEIGTH) / 2 + (FONT_SIZE + LINE_PADDING) * i);
        }
    }

    drawScore(score) {
        this.context2d.save();
        this.context2d.setTransform(new DOMMatrix()); 
        this.context2d.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.context2d.font = "bold 20px sans-serif"; 
        this.context2d.textAlign = "left";
        this.context2d.fillText(`SCORE: ${score}`, 40, 50);
        this.context2d.restore();
    }

    drawLine(points, color) {
        this.context2d.beginPath();
        for (let i = 0; i < points.length; ++i) {
            let screenPoint = this.worldToCamera(points[i]);
            if (i == 0) this.context2d.moveTo(screenPoint.x, screenPoint.y);
            else this.context2d.lineTo(screenPoint.x, screenPoint.y);
        }
        this.context2d.strokeStyle = color.toRgba();
        this.context2d.stroke();
    }

    setViewport(width, height) {
        const scale = Math.min(width / DEFAULT_RESOLUTION.w, height / DEFAULT_RESOLUTION.h);
        this.unitsPerPixel = 1 / scale;
        this.context2d.setTransform(new DOMMatrix());
        this.context2d.scale(scale, scale);
    }

    present() {}
    setTimestamp(timestamp) {}

    background() {
        let bounds = this.getScreenWorldBounds();
        let gridBoundsXMin = Math.floor(bounds[0].x / BACKGROUND_CELL_WIDTH);
        let gridBoundsXMax = Math.floor(bounds[1].x / BACKGROUND_CELL_WIDTH);
        let gridBoundsYMin = Math.floor(bounds[0].y / BACKGROUND_CELL_HEIGHT);
        let gridBoundsYMax = Math.floor(bounds[1].y / BACKGROUND_CELL_HEIGHT);

        for (let cellX = gridBoundsXMin; cellX <= gridBoundsXMax + 1; ++cellX) {
            for (let cellY = gridBoundsYMin; cellY <= gridBoundsYMax; ++cellY) {
                let offset = new V2(cellX * BACKGROUND_CELL_WIDTH, (cellY + (cellX % 2 == 0 ? 0.5 : 0)) * BACKGROUND_CELL_HEIGHT);
                let points = BACKGROUND_CELL_POINTS.map(p => p.add(offset));
                this.drawLine(points, BACKGROUND_LINE_COLOR);
            }
        }
    }
}

const DEFAULT_RESOLUTION = {w: 3840, h: 2160};
const SUN_COLOR_FLARE = Color.hex("#ffd700");
const SOLAR_FLARE_SPEED = 2500;
const PLAYER_SPEED = 1000;
const INITIAL_PLAYER_RADIUS = 180; 
const MIN_PLAYER_RADIUS = 30;
const BULLET_RADIUS = 25; 
const BULLET_LIFETIME = 4.0;

const BASE_ENEMY_SPEED = 460;
const ENEMY_RADIUS = 75;
const ENEMY_SPAWN_ANIMATION_SPEED = ENEMY_RADIUS * 10;

const PARTICLES_COUNT_RANGE = [15, 35];
const PARTICLE_RADIUS_RANGE = [5.0, 15.0];
const PARTICLE_MAG_RANGE = [200, 700];
const PARTICLE_MAX_LIFETIME = 0.8;
const PARTICLE_LIFETIME_RANGE = [0.2, PARTICLE_MAX_LIFETIME];
const BACKGROUND_CELL_RADIUS = 120;
const BACKGROUND_LINE_COLOR = Color.hex("#111115").withAlpha(0.4); 
const BACKGROUND_CELL_WIDTH = 1.5 * BACKGROUND_CELL_RADIUS;
const BACKGROUND_CELL_HEIGHT = Math.sqrt(3) * BACKGROUND_CELL_RADIUS;
const BACKGROUND_CELL_POINTS = (() => {
    let points = [];
    for (let i = 0; i < 4; ++i) {
        let angle = 2 * Math.PI * i / 6;
        points.push(new V2(Math.cos(angle), Math.sin(angle)).scale(BACKGROUND_CELL_RADIUS));
    }
    return points;
})();

const directionMap = {
    'KeyS': new V2(0, 1.0),
    'KeyW': new V2(0, -1.0),
    'KeyA': new V2(-1.0, 0),
    'KeyD': new V2(1.0, 0)
};

class Particle {
    constructor(pos, vel, lifetime, radius, color) {
        this.pos = pos; this.vel = vel; this.lifetime = lifetime; this.radius = radius; this.color = color;
    }
    render(renderer) {
        const a = Math.max(0, this.lifetime / PARTICLE_MAX_LIFETIME);
        renderer.fillCircle(this.pos, this.radius, this.color.withAlpha(a));
    }
    update(dt) {
        this.pos = this.pos.add(this.vel.scale(dt));
        this.lifetime -= dt;
    }
}

function ghostBurst(particles, center) {
    const N = randomBetween(...PARTICLES_COUNT_RANGE);
    const phantomDebris = new Color(0.92, 0.92, 0.95, 0.75); 
    for (let i = 0; i < N; ++i) {
        particles.push(new Particle(
            center,
            V2.polar(randomBetween(...PARTICLE_MAG_RANGE), randomAngle()),
            randomBetween(...PARTICLE_LIFETIME_RANGE),
            randomBetween(...PARTICLE_RADIUS_RANGE),
            phantomDebris
        ));
    }
}

class Enemy {
    constructor(pos, speed) {
        this.pos = pos; this.ded = false; this.radius = 0.0; this.speed = speed;
    }
    update(dt, followPos) {
        let vel = followPos.sub(this.pos).normalize().scale(this.speed * dt);
        this.pos = this.pos.add(vel);
        if (this.radius < ENEMY_RADIUS) this.radius += ENEMY_SPAWN_ANIMATION_SPEED * dt;
        else this.radius = ENEMY_RADIUS;
    }
    render(renderer) {
        renderer.drawShadow(this.pos, this.radius);
    }
}

class Bullet {
    constructor(pos, vel) {
        this.pos = pos; this.vel = vel; this.lifetime = BULLET_LIFETIME;
    }
    update(dt) {
        this.pos = this.pos.add(this.vel.scale(dt));
        this.lifetime -= dt;
    }
    render(renderer) {
        renderer.drawGradientBullet(this.pos, BULLET_RADIUS, this.vel);
    }
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const renderer = new Renderer2D(ctx);

let playerPos = new V2(0, 0);
let playerRadius = INITIAL_PLAYER_RADIUS;
let score = 0;
let isGameOver = false;

let bullets = [];
let enemies = [];
let particles = [];
let keysPressed = {};
let mouseScreenPos = new V2(0, 0);

let lastSpawnTime = 0;

let currentSpawnInterval = 800;
let computedEnemyVelocity = BASE_ENEMY_SPEED;

function spawnEnemyOffscreen() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 1700; 
    const spawnPos = playerPos.add(new V2(Math.cos(angle) * distance, Math.sin(angle) * distance));
    enemies.push(new Enemy(spawnPos, computedEnemyVelocity));
}

window.addEventListener("keydown", (e) => {
    if (isGameOver && e.code === "KeyR") {
        playerPos = new V2(0, 0);
        playerRadius = INITIAL_PLAYER_RADIUS;
        score = 0;
        bullets = [];
        enemies = [];
        particles = [];
        isGameOver = false;
    }
    keysPressed[e.code] = true;
});
window.addEventListener("keyup", (e) => keysPressed[e.code] = false);
window.addEventListener("mousemove", (e) => {
    mouseScreenPos = new V2(e.clientX, e.clientY);
});

window.addEventListener("mousedown", () => {
    if (isGameOver) return;
    const worldMouse = renderer.screenToWorld(mouseScreenPos);
    const fireDir = worldMouse.sub(playerPos).normalize();
    if (fireDir.len() > 0 || (fireDir.x !== 0 || fireDir.y !== 0)) {
        bullets.push(new Bullet(playerPos, fireDir.scale(SOLAR_FLARE_SPEED)));
    } else {
        bullets.push(new Bullet(playerPos, new V2(SOLAR_FLARE_SPEED, 0)));
    }
});

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.setViewport(canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
resize();

let lastTime = performance.now();

function loop(now) {
    let dt = (now - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; 
    lastTime = now;

    if (!isGameOver) {
        const waveFrequency = now * 0.00025; 
        const waveIntensity = Math.sin(waveFrequency); 
        
        const progressionBase = Math.min(300, now * 0.0035);

        currentSpawnInterval = 850 - (waveIntensity * 450) - (progressionBase * 0.9);
        currentSpawnInterval = Math.max(200, currentSpawnInterval); 

        computedEnemyVelocity = BASE_ENEMY_SPEED + (waveIntensity * 220) + progressionBase;
        computedEnemyVelocity = Math.min(950, computedEnemyVelocity); 

        let moveDir = new V2(0, 0);
        for (let code in directionMap) {
            if (keysPressed[code]) moveDir = moveDir.add(directionMap[code]);
        }
        if (moveDir.len() > 0) {
            playerPos = playerPos.add(moveDir.normalize().scale(PLAYER_SPEED * dt));
        }

        if (now - lastSpawnTime > currentSpawnInterval) {
            spawnEnemyOffscreen();
            lastSpawnTime = now;
        }

        bullets.forEach(b => b.update(dt));
        enemies.forEach(e => e.update(dt, playerPos));
        particles.forEach(p => p.update(dt));

        for (let b of bullets) {
            for (let e of enemies) {
                if (!e.ded && b.pos.dist(e.pos) < (BULLET_RADIUS + e.radius)) {
                    e.ded = true;
                    b.lifetime = 0; 
                    score += 100;
                    ghostBurst(particles, e.pos);
                }
            }
        }

        for (let e of enemies) {
            if (!e.ded && playerPos.dist(e.pos) < (playerRadius * 0.85 + e.radius * 0.5)) { 
                e.ded = true;
                playerRadius -= 15; 
                ghostBurst(particles, e.pos);
                
                if (playerRadius < MIN_PLAYER_RADIUS) {
                    isGameOver = true;
                }
            }
        }

        bullets = bullets.filter(b => b.lifetime > 0);
        enemies = enemies.filter(e => !e.ded);
        particles = particles.filter(p => p.lifetime > 0);

        renderer.setTarget(playerPos);
    }

    renderer.update(dt);

    renderer.clear();
    renderer.background();

    particles.forEach(p => p.render(renderer));
    bullets.forEach(b => b.render(renderer));
    enemies.forEach(e => e.render(renderer));
    
    if (!isGameOver) {
        renderer.drawSun(playerPos, playerRadius, now);
    } else {
        renderer.fillMessage("ECLIPSED\nPRESS R TO RESTART", Color.hex("#ffffff"));
    }

    renderer.drawScore(score);

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);