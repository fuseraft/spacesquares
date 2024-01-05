// Setting up canvas
let canvas = document.getElementById("gameCanvas");
let ctx = canvas.getContext("2d");
canvas.width = window.innerWidth * 0.9; // 90% of window width
canvas.height = window.innerHeight * 0.8; // 80% of window height

// Game variables
let touchStartPos = null;
let isTouchEnabled = false;
let gravity = 0.5;
let ground = canvas.height - 50;
let keys = {};
let score = 0;
let gameTimer = 0;
let timerInterval;
let safeDistance = 150;
let highestScore = 0;
let isGameOver = false;
let continueButton = {
  height: 40,
  width: 120,
  x: canvas.width / 2 - 50,
  y: canvas.height / 2 + 50,
};
let player;
let enemies;
let stars;

function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

class GameObject {
  constructor(x, y, width, height, color) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

class Player extends GameObject {
  constructor(x, y, width, height, color) {
    super(x, y, width, height, color);
    this.velocity = { x: 0, y: 0 };
    this.speed = 5;
    this.boostSpeed = 10;
    this.jumpPower = 10;
    this.isJumping = false;
    this.isAlive = true;
    this.swipeImpulse = 10; // Impulse applied on swipe
    this.friction = 0.95; // Friction factor to reduce velocity
  }

  draw() {
    super.draw();
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("o_o", this.x + 10, this.y + this.height / 2);
  }

  update() {
    try {
      // Boosted movement
      var currentSpeed = this.speed;
      if (keys["ArrowDown"] || keys["s"]) {
        currentSpeed = this.boostSpeed;
      }

      // Movement
      if (keys["ArrowRight"] || keys["d"]) {
        this.velocity.x = currentSpeed;
      } else if (keys["ArrowLeft"] || keys["a"]) {
        this.velocity.x = -currentSpeed;
      } else if (isTouchEnabled) {
        /*this.velocity.x = Math.sign(this.velocity.x) * currentSpeed;*/
      } else {
        this.velocity.x = 0;
      }

      // Gravity and jumping
      if (!this.isJumping) {
        if ((keys[" "] || keys["w"]) && this.isAlive) {
          this.isJumping = true;
          this.velocity.y = -this.jumpPower;
        }
      } else {
        this.velocity.y += gravity;
        if (this.y + this.height >= ground) {
          this.isJumping = false;
          this.y = ground - this.height;
          this.velocity.y = 0;
          this.velocity.x = 0;
        }
      }

      // Update position
      this.x += this.velocity.x;
      this.y += this.velocity.y;

      if (this.x < 0) {
        this.x = 0;
      } else if (this.x + this.width > canvas.width) {
        this.x = canvas.width - this.width;
      }

      // Apply friction to reduce velocity over time
      this.velocity.x *= this.friction;

      // Stop completely if velocity is very low
      if (Math.abs(this.velocity.x) < 0.1) {
        this.velocity.x = 0;
      }

      this.draw();
    } catch (ex) {
      console.error(ex);
    }
  }

  checkCollision(enemy) {
    // Check for any collision first
    if (
      this.x < enemy.x + enemy.width &&
      this.x + this.width > enemy.x &&
      this.y < enemy.y + enemy.height &&
      this.y + this.height > enemy.y
    ) {
      // Check for top collision, including corner collisions
      if (
        this.y + this.height > enemy.y &&
        this.y < enemy.y &&
        this.velocity.y > 0
      ) {
        if (
          (this.x + this.width > enemy.x && this.x < enemy.x) ||
          (this.x < enemy.x + enemy.width &&
            this.x + this.width > enemy.x + enemy.width)
        ) {
          return "corner";
        }
        return "top";
      }

      // Check for side collision
      if (
        (this.x < enemy.x && this.x + this.width > enemy.x) ||
        (this.x < enemy.x + enemy.width &&
          this.x + this.width > enemy.x + enemy.width)
      ) {
        return "side";
      }
    }

    return null;
  }
}

class Enemy extends GameObject {
  constructor(x, y, width, height, color, boundaryLeft, boundaryRight, speed) {
    super(x, y, width, height, color);
    this.boundaryLeft = boundaryLeft;
    this.boundaryRight = boundaryRight;
    this.speed = speed;
    this.direction = 1;
    this.isAlive = true;
  }

  draw() {
    super.draw();
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(
      this.speed > 2 ? "*O*" : "*w*",
      this.x + 10,
      this.y + this.height / 2 + 6
    );
  }

  update() {
    if (!this.isAlive) {
      return;
    }

    // Move just within boundaries
    if (
      this.x + this.width > this.boundaryRight ||
      this.x < this.boundaryLeft
    ) {
      this.direction *= -1;
    }
    this.x += this.speed * this.direction;

    this.draw();
  }
}

class Star {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = this.getRandomColor();
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }

  getRandomColor() {
    const brightColors = [
      "#FF5733",
      "#33FF57",
      "#3357FF",
      "#FF33F5",
      "#F5FF33",
      "#33FFF8",
      "#8D33FF",
      "#FF8D33",
      "#33FF8D",
    ];
    return brightColors[Math.floor(Math.random() * brightColors.length)];
  }

  changeColor() {
    this.color = this.getRandomColor();
  }
}

function initGame() {
  player = new Player(50, ground - 50, 50, 50, "blue");
  enemies = [];
  // For funsies
  stars = [];
  for (let i = 0; i < 42; i++) {
    stars.push(
      new Star(Math.random() * canvas.width, Math.random() * canvas.height, 3)
    );
  }
  setInterval(function () {
    stars.forEach((star) => star.changeColor());
  }, 2000);
  attachEventListeners();
  startGame();
}

function startGame() {
  player = new Player(50, ground - 50, 50, 50, "blue");
  enemies = [];
  score = 0;
  gameTimer = 0;
  isGameOver = false;
  timerLoop();
  spawnLoop();
  gameLoop();
}

function endGame() {
  clearInterval(timerInterval);
  clearInterval(spawnInterval);
  isGameOver = true;
  player.isAlive = false;
  drawGameOverScreen();
}

function drawGameOverScreen() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "40px Arial";
  ctx.fillText("Game Over!", canvas.width / 2 - 100, canvas.height / 2);

  ctx.font = "20px Arial";
  ctx.fillText(
    "Score: " + score + " | Best: " + highestScore,
    canvas.width / 2 - 70,
    canvas.height / 2 + 30
  );

  // Draw Continue button
  ctx.fillStyle = "blue";
  ctx.fillRect(
    continueButton.x,
    continueButton.y,
    continueButton.width,
    continueButton.height
  );
  ctx.fillStyle = "white";
  ctx.fillText("Continue", continueButton.x + 20, continueButton.y + 25);
}

function restartGame() {
  if (isGameOver) {
    highestScore = Math.max(highestScore, score);
    score = 0;
    gameTimer = 0;
    startGame();
  }
}

function gameLoop() {
  try {
    if (isGameOver) {
      return;
    }

    requestAnimationFrame(gameLoop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach((star) => star.draw());

    // Update and draw player
    player.x += player.velocity.x;
    player.y += player.velocity.y;
    player.update();

    // Update and draw enemies
    enemies.forEach(function (enemy, index) {
      if (!enemy.isAlive) {
        return;
      }

      enemy.update();

      var collisionType = player.checkCollision(enemy);
      if (collisionType) {
        if (collisionType !== "side") {
          enemy.isAlive = false;
          score += enemy.speed == 2 ? 1 : 2;

          // Remove the enemy from the array
          enemies.splice(index, 1);
        } else if (collisionType === "side") {
          endGame();
        }
      }
    });

    if (isGameOver) {
      return;
    }

    // Draw ground
    ctx.fillStyle = "grey";
    ctx.fillRect(0, ground, canvas.width, 50);

    // Display score and timer
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, 10, 30);
    ctx.fillText("Time: " + gameTimer + "s", canvas.width - 100, 30);
  } catch (ex) {
    console.error(ex);
  }
}

function timerLoop() {
  timerInterval = setInterval(function () {
    gameTimer++;
  }, 1000);
}

function spawnLoop() {
  const initialEnemyCount = 3;
  for (var i = 0; i < initialEnemyCount; ++i) {
    spawnEnemy();
  }
  spawnInterval = setInterval(spawnEnemy, 3000);
}

function spawnEnemy() {
  const maxEnemies = 5;
  // Check if the number of alive enemies is less than the limit
  if (enemies.filter((enemy) => enemy.isAlive).length < maxEnemies) {
    var x;
    do {
      x = Math.random() * (canvas.width - 100) + 50;
    } while (Math.abs(player.x - x) < safeDistance);

    var isFastEnemy = Math.random() < 0.3;
    var color = isFastEnemy ? "red" : "purple";
    var speed = isFastEnemy ? 4 : 2;

    var boundaryRange = isFastEnemy ? 50 : 150;
    var boundaryLeft = x - boundaryRange;
    var boundaryRight = x + boundaryRange;

    var newEnemy = new Enemy(
      x,
      ground - 50,
      50,
      50,
      color,
      boundaryLeft,
      boundaryRight,
      speed
    );
    enemies.push(newEnemy);
  }
}

function handleSwipeAction(touchEndPos) {
  if (!touchStartPos || player.isJumping) return;

  const dx = touchEndPos.x - touchStartPos.x;
  const dy = touchEndPos.y - touchStartPos.y;
  const swipeThreshold = 20; // Threshold for detecting a swipe
  const jumpThreshold = -20; // Negative threshold for detecting an upward swipe

  // Apply a controlled impulse based on the swipe distance
  if (Math.abs(dx) > swipeThreshold) {
    player.velocity.x += Math.sign(dx) * player.swipeImpulse;
    // Limit the velocity to the maximum speed
    player.velocity.x = Math.min(
      Math.max(player.velocity.x, -player.speed),
      player.speed
    );
  }

  // Handling vertical swipes for jumping
  if (dy < jumpThreshold && !player.isJumping) {
    player.isJumping = true;
    player.velocity.y = -player.jumpPower; // Apply negative velocity for upward movement
  }
}

function isWithinButton(x, y, button) {
  return (
    x >= button.x &&
    x <= button.x + button.width &&
    y >= button.y &&
    y <= button.y + button.height
  );
}

function attachEventListeners() {
  canvas.addEventListener("touchstart", function (event) {
    var touch = event.touches[0];
    isTouchEnabled = true;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    if (
      isGameOver &&
      isWithinButton(touch.clientX, touch.clientY, continueButton)
    ) {
      restartGame();
    }
    event.preventDefault();
  });

  canvas.addEventListener(
    "touchend",
    throttle(function (event) {
      var touch = event.changedTouches[0];
      var touchEndPos = { x: touch.clientX, y: touch.clientY };
      handleSwipeAction(touchEndPos);
      touchStartPos = null;
    }, 100)
  );

  canvas.addEventListener("mousedown", function (event) {
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;

    if (isWithinButton(x, y, continueButton)) {
      restartGame();
    }
  });

  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (isGameOver && keys["Enter"]) {
      restartGame();
      return;
    }
  });
  window.addEventListener("keyup", (e) => (keys[e.key] = false));
}

// WIP: prevent pull-to-refresh
function preventPullToRefresh(element) {
  var prevent = false;
  document.querySelector(element).addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) {
      return;
    }
    var scrollY =
      window.pageYOffset ||
      document.body.scrollTop ||
      document.documentElement.scrollTop;
    prevent = scrollY === 0;
  });
  document.querySelector(element).addEventListener("touchmove", function (e) {
    if (prevent) {
      prevent = false;
      e.preventDefault();
    }
  });
}

window.onload = function () {
  preventPullToRefresh("body");
};

initGame();
