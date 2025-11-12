// --- 圓的設定 ---
let circles = [];
const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
const NUM_CIRCLES = 20;

// 新增：爆破粒子陣列與參數
let particles = [];
const PARTICLE_MIN = 12;
const PARTICLE_MAX = 28;

// 改為即時合成爆破音（避免外部檔案 404）
let popOsc;   // p5.Oscillator
let popEnv;   // p5.Envelope

// 分數
let score = 0;

function preload() {
  // 不再嘗試載入 assets/pop.mp3（避免 404）
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 若 live-server 或其他工具在 body 中加入載入提示，啟動後移除它
  let loader = document.getElementById('p5_loading');
  if (loader) loader.remove();

  // 初始化即時音源：一個 oscillator + envelope 用來做 pop 音效
  // 注意：部分瀏覽器需要在使用者互動後才能發聲（mousePressed 已嘗試 resume）
  popOsc = new p5.Oscillator('triangle');
  popOsc.start();
  popOsc.amp(0); // 預設靜音，由 envelope 控制音量
  popEnv = new p5.Envelope();
  // env.setADSR(attackTime, decayTime, sustainLevel, releaseTime)
  popEnv.setADSR(0.001, 0.05, 0.0, 0.02);
  popEnv.setRange(1.0, 0); // peak amplitude 1.0 -> envelope 播放時用第二參數 scale

  // 初始化圓
  circles = [];
  for (let i = 0; i < NUM_CIRCLES; i++) {
    circles.push({
      x: random(width),
      y: random(height),
      r: random(50, 200),
      color: color(random(COLORS)),
      alpha: random(80, 255),
      speed: random(1, 5)
    });
  }
}

function draw() {
  background('#fcf6bd');

  // 左上角文字
  textAlign(LEFT, TOP);
  textSize(32);
  fill('#eb6424');
  noStroke();
  text('414730100', 10, 10);

  // 右上角分數（與左上相同樣式）
  textAlign(RIGHT, TOP);
  textSize(32);
  fill('#eb6424');
  text(String(score), width - 10, 10);

  noStroke();
  for (let c of circles) {
    c.y -= c.speed;

    if (c.y + c.r / 2 < 0) { // 如果圓完全移出畫面頂端
      c.y = height + c.r / 2;  // 從底部重新出現
      c.x = random(width);
      c.r = random(50, 200);
      c.color = color(random(COLORS));
      c.alpha = random(80, 255);
      c.speed = random(1, 5);
    }
    c.color.setAlpha(c.alpha); // 設定透明度
    fill(c.color); // 使用設定的顏色
    circle(c.x, c.y, c.r); // 畫圓

    // 在圓的右上方1/4圓的中間產生方形
    let squareSize = c.r / 6;
    let angle = -PI / 4; // 右上45度
    let distance = c.r / 2 * 0.65;
    let squareCenterX = c.x + cos(angle) * distance;
    let squareCenterY = c.y + sin(angle) * distance;
    fill(255, 255, 255, 120); // 白色透明
    noStroke();
    rectMode(CENTER);
    rect(squareCenterX, squareCenterY, squareSize, squareSize);
  }

  // 更新並繪製粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.vy += 0.12; // 重力
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    p.alpha -= p.decay * 200; // 控制可視透明度衰減速度
    if (p.alpha < 0) p.alpha = 0;

    noStroke();
    let col = color(p.col);
    col.setAlpha(constrain(p.alpha, 0, 255));
    fill(col);
    circle(p.x, p.y, p.size);

    if (p.life <= 0 || p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新分布圓的位置
  for (let c of circles) {
    c.x = random(width);
    c.y = random(height);
  }
}

// 當滑鼠按下時檢查是否點到氣球（第一個命中即處理）
function mousePressed() {
  // 嘗試在使用者互動時啟動音訊（部分瀏覽器需要）
  if (typeof userStartAudio === 'function') {
    userStartAudio();
  } else if (typeof getAudioContext === 'function') {
    let ac = getAudioContext();
    if (ac && ac.state === 'suspended' && typeof ac.resume === 'function') ac.resume();
  }

  // 由最後一個元素開始檢查可優先命中畫面上較晚繪製的氣球
  for (let i = circles.length - 1; i >= 0; i--) {
    let c = circles[i];
    let d = dist(mouseX, mouseY, c.x, c.y);
    if (d <= c.r / 2) {
      // 取得顏色字串（小寫），確保 hex 的參數為整數
      let colStr =
        '#' +
        hex(floor(red(c.color)), 2) +
        hex(floor(green(c.color)), 2) +
        hex(floor(blue(c.color)), 2);
      colStr = colStr.toLowerCase();

      if (colStr === '#1982c4') {
        score += 1;
      } else {
        score -= 1;
      }

      // 產生爆破效果（含即時合成音效）
      createExplosion(c.x, c.y, c.r, c.color);

      // 重新產生氣球（爆破後從底部重新出現）
      c.y = height + c.r / 2;
      c.x = random(width);
      c.r = random(50, 200);
      c.color = color(random(COLORS));
      c.alpha = random(80, 255);
      c.speed = random(1, 5);

      break; // 只處理第一個被點到的氣球
    }
  }
}

// 建立爆破粒子函式（同時播放即時合成音效）
function createExplosion(x, y, radius, col) {
  // 即時合成 pop 音：改變頻率與音量，使用 envelope 播放 oscillator
  if (popOsc && popEnv) {
    // 隨機頻率與短暫雜訊感：主頻 + 快速 pitch sweep
    let f = random(700, 1700) * map(radius, 50, 200, 0.8, 1.2);
    popOsc.freq(f);
    // 使用少量 noise-like感覺：短時間內快速更改頻率
    let sweep = random(1.05, 1.3);
    popOsc.freq(f * sweep, 0.01); // 緩變到 f * sweep（非常短）
    // 使用 envelope 播放，並調整振幅大小
    popEnv.setRange(random(0.6, 1.0), 0);
    popEnv.play(popOsc);
  }

  let count = floor(random(PARTICLE_MIN, PARTICLE_MAX));
  for (let i = 0; i < count; i++) {
    let angle = random(TWO_PI);
    let speed = random(1, map(radius, 50, 200, 2, 6)) * random(0.6, 1.6);
    let vx = cos(angle) * speed;
    let vy = sin(angle) * speed * 0.8;
    let size = random(3, map(radius, 50, 200, 6, 14));
    let life = random(20, 60);
    let decay = random(0.01, 0.03);
    // 儲存顏色字串（保留原氣球顏色）
    let colStr = '#' + hex(floor(red(col)), 2) + hex(floor(green(col)), 2) + hex(floor(blue(col)), 2);
    particles.push({
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      size: size,
      life: life,
      decay: decay,
      col: colStr,
      alpha: random(180, 255)
    });
  }
}