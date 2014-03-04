/* global Player, Projectile, Zombie, Explosion, ObjectPoolMaker */

(function () {
  'use strict';

  var Game = {
    init: function () {
      Game.canvas = document.getElementById('game-canvas');
      Game.context = Game.canvas.getContext('2d');

      Game.loadBackground();
      Game.bind();
      Game.reset();
    },

    bind: function () {
      document.addEventListener('keydown', function (e) {
        Game.keysDown[e.keyCode] = true;
      }, false);

      document.addEventListener('keyup', function (e) {
        delete Game.keysDown[e.keyCode];
      }, false);

      document.getElementById('play-again').addEventListener('click', function (e) {
        Game.reset();
      });
    },

    reset: function () {
      // Current game difficulty
      Game.difficulty = 0.01;

      // Max difficulty that Game can reach at any given time
      // It represents the chance percentage of spawning a new Zombie
      Game.maxDifficulty = 0.2;

      // How much difficulty increases after its cooldown elapsed
      Game.difficultyIncrement = 0.005;

      // How long it takes (in seconds) to difficulty to increase
      Game.difficultyCooldown = 3;

      // Last time difficulty was increased
      Game.lastDifficultyIncrease = 0;

      // Time elapsed since Game began
      Game.gameTime = 0;

      // Total score from killing zombies
      Game.score = 0;

      // Maps which keys as currently pressed by e.keyCode
      Game.keysDown = {};

      // Last time a projectile was shot by the player
      Game.lastProjectileTime = 0;

      // How long it takes (in ms) for another projectile to be fired
      Game.projectileCooldown = 100;

      // How many pixels Player and Zombies are constrained by vertically/horizontally
      // (this is interesting according to the background image used)
      Game.verticalBoundary = 35;
      Game.horizontalBoundary = 5;

      Game.isGameOver = false;

      Game.player = new Player(
        Game.canvas.width / 2 - Player.width / 2,
        Game.canvas.height / 2 - Player.height / 2
      );

      // Store pool of objects to be reused for each Entity
      Game.zombiePool = new ObjectPoolMaker(Zombie, 100);
      Game.projectilePool = new ObjectPoolMaker(Projectile, 100);

      // Got lazy here and just used an array.. soon to be updated :p
      Game.explosions = [];

      document.getElementById('game-over-overlay').style.display = 'none';
      document.getElementById('game-over').style.display = 'none';
    },

    loadBackground: function () {
      Game.backgroundReady = false;

      Game.backgroundImg = new Image();
      Game.backgroundImg.src = 'public/images/background.png';

      Game.backgroundImg.onload = function () {
        Game.backgroundReady = true;
      };
    },

    update: function (modifier) {
      Game.gameTime += modifier;

      Game.handleInput(modifier);
      Game.handleDifficulty();
      Game.spawnZombies();
      Game.updateEntities(modifier);
    },

    handleInput: function (modifier) {
      if (Game.isGameOver) {
        return;
      }

      var now = Date.now();

      // UP
      if (Game.keysDown[38] && Game.player.y > Game.verticalBoundary) {
        Game.player.setY(Game.player.y - (Game.player.speed * modifier));
      }

      // DOWN
      if (Game.keysDown[40] && Game.player.y < Game.canvas.height - Game.verticalBoundary - Player.height) {
        Game.player.setY(Game.player.y + (Game.player.speed * modifier));
      }

      // RIGHT
      if (Game.keysDown[39] && Game.player.x < Game.canvas.width - Game.horizontalBoundary - Player.width) {
        Game.player.setX(Game.player.x + (Game.player.speed * modifier));
      }

      // LEFT
      if (Game.keysDown[37] && Game.player.x > Game.horizontalBoundary) {
        Game.player.setX(Game.player.x - (Game.player.speed * modifier));
      }

      // SPACE - shoot!
      if (Game.keysDown[32]) {
        // prevent spamming projectiles
        if (now - Game.lastProjectileTime > Game.projectileCooldown) {
          Game.projectilePool.create(
            Game.player.x,
            Game.player.y + (Player.height / 2) - (Projectile.height / 2)
          );
          Game.lastProjectileTime = now;
        }
      }
    },

    handleDifficulty: function () {
      // It gets harder as time goes by..
      if (Game.difficulty < Game.maxDifficulty &&
          Game.gameTime - Game.lastDifficultyIncrease > Game.difficultyCooldown) {
        Game.difficulty += Game.difficultyIncrement;
        Game.lastDifficultyIncrease = Game.gameTime;
      }
    },

    spawnZombies: function () {
      // Create some enemies
      if (Math.random() < Game.difficulty) {
        // resets x coordinate
        // randomize new y coordinate (constrained in available map space)
        Game.zombiePool.create(
          Game.canvas.width,
          Math.random() * (Game.canvas.height - Zombie.height - (2 * Game.verticalBoundary)) + Game.verticalBoundary
        );
      }
    },

    updateEntities: function (modifier) {
      Game.updateProjectilesAndKillZombies(modifier);
      Game.updateZombies(modifier);
      Game.updateExplosions();
      Game.updatePlayer();
    },

    updateProjectilesAndKillZombies: function (modifier) {
      var i,
          j,
          zombie,
          projectile;

      // update all projectiles
      for (i = 0; i < Game.projectilePool.size(); i++) {
        projectile = Game.projectilePool.objectPool()[i];

        projectile.setX(projectile.x + (projectile.speed * modifier));

        // delete projectile if out of the scene
        if (projectile.x > Game.canvas.width) {
          Game.projectilePool.destroy(projectile);
          i--;
        }
        else {
          // kill zombies!
          for (j = 0; j < Game.zombiePool.size(); j++) {
            zombie = Game.zombiePool.objectPool()[j];
            if (projectile.isCollided(zombie)) {
              Game.explosions.push(new Explosion(zombie.x, zombie.y));

              // hundred points for each zombie!
              Game.score += 100;

              Game.projectilePool.destroy(projectile);
              i--;
              Game.zombiePool.destroy(zombie);
              j--;

              break;
            }
          }
        }
      }
    },

    updateZombies: function (modifier) {
      var zombie,
          i,
          now = Date.now();

      // update all enemies
      for (i = 0; i < Game.zombiePool.size(); i++) {
        zombie = Game.zombiePool.objectPool()[i];
        zombie.update(now);
        zombie.setX(zombie.x - (zombie.speed * modifier));

        // delete zombie if out of the scene
        if (zombie.x + Zombie.width < 0) {
          Game.zombiePool.destroy(zombie);
          i--;
        }
      }
    },

    updateExplosions: function () {
      var i;

      for (i = 0; i < Game.explosions.length; ++i) {
        Game.explosions[i].update();
        if (Game.explosions[i].currentFrame >= Explosion.framesPosition.length - 1) {
          Game.explosions.splice(i--, 1);
        }
      }
    },

    updatePlayer: function () {
      var zombie,
          i;

      if (!Game.isGameOver) {
        for (i = 0; i < Game.zombiePool.size(); ++i) {
          zombie = Game.zombiePool.objectPool()[i];
          if (zombie.isCollided(Game.player)) {
            Game.gameOver();
            break;
          }
        }
      }
    },

    gameOver: function () {
      document.getElementById('game-over-overlay').style.display = 'block';
      document.getElementById('game-over').style.display = 'block';
      Game.isGameOver = true;
    },

    render: function () {
      var i;

      // Render Background
      if (Game.backgroundReady) {
        Game.context.drawImage(Game.backgroundImg, 0, 0);
      }

      // Render Projectiles
      for (i = 0; i < Game.projectilePool.size(); ++i) {
        Game.projectilePool.objectPool()[i].render(Game.context);
      }

      // Render Explosions
      for (i = 0; i < Game.explosions.length; ++i) {
        Game.explosions[i].render(Game.context);
      }

      // Render Zombies
      for (i = 0; i < Game.zombiePool.size(); ++i) {
        Game.zombiePool.objectPool()[i].render(Game.context);
      }

      // Render Player
      if (!Game.isGameOver) {
        Game.player.render(Game.context);
      }

      // Render score
      Game.renderStatus();
    },

    renderStatus: function () {
      Game.context.fillStyle = '#fff';
      Game.context.font = '20px Helvetica';
      Game.context.textAlign = 'left';
      Game.context.textBaseline = 'top';

      Game.context.fillText('Score: ' + Game.score, 10, 5);
      Game.context.fillText('Level: ' + Game.player.level, Game.canvas.width - 110, 5);
    }
  };

  // expose Game globally
  window.Game = Game;
}());