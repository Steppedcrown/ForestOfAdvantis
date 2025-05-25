class Platformer extends Phaser.Scene {
    constructor() {
        super("level1");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 500;
        this.DRAG = 6 * this.ACCELERATION;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -500;
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 2.0;

        this.isGameOver = false;
        this.inputLocked = false;
        this.spawnPoint = [75, 245]; // default spawn point
        this.coyoteTime = 0;
        this.COYOTE_DURATION = 100; // milliseconds of grace period
        this.jumpBufferRemaining = 0;
        this.hasJumped = false; // flag to check if the player has jumped
        this.JUMP_BUFFER_DURATION = 100; // milliseconds to buffer a jump input
        this.JUMP_CUTOFF_VELOCITY = -200;  // Control how "short" a short hop is
        this.UI_DEPTH = 99; // UI depth for buttons and text
    }

    preload() {
        this.load.scenePlugin('AnimatedTiles', './lib/AnimatedTiles.js', 'animatedTiles', 'animatedTiles');
    }

    create() {
        // Create a new tilemap game object
        this.map = this.add.tilemap("platformer-level-1", 18, 18, 80, 20);

        // Add a tileset to the map
        // First parameter: name we gave the tileset in Tiled
        // Second parameter: key for the tilesheet (from this.load.image in Load.js)
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");

        // Create layers
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.undergroundLayer = this.map.createLayer("Underground", this.tileset, 0, 0);
        this.detailLayer = this.map.createLayer("Details", this.tileset, 0, 0);
        this.waterfallLayer = this.map.createLayer("Waterfalls", this.tileset, 0, 0);

        // Order the layers
        this.groundLayer.setDepth(-1);
        this.undergroundLayer.setDepth(-3);
        this.detailLayer.setDepth(-2);
        this.waterfallLayer.setDepth(2);

        // Enable animated tiles
        this.animatedTiles.init(this.map);

        // Make it collidable
        this.groundLayer.setCollisionByProperty({
            collides: true
        });

        // set up player avatar
        my.sprite.player = this.physics.add.sprite(this.spawnPoint[0], this.spawnPoint[1], "platformer_characters", "tile_0000.png");
        my.sprite.player.setFlip(true, false); // face right
        my.sprite.player.setMaxVelocity(300, 1500); // max speed
        my.sprite.player.body.setSize(14, 16).setOffset(6, 6);
        my.sprite.player.setDepth(1);

        // Bounds
        this.physics.world.setBounds(0, -0, this.map.widthInPixels, this.map.heightInPixels);
        this.physics.world.setBoundsCollision(true, true, true, false);  // left, right, top, bottom
        my.sprite.player.setCollideWorldBounds(true);
        this.lastSafePosition = this.spawnPoint;

        // Bounds
        this.physics.world.setBoundsCollision(true, true, true, false);  // left, right, top, bottom
        my.sprite.player.setCollideWorldBounds(true);
        this.lastSafePosition = this.spawnPoint;


        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Add camera
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1); // (target, [,roundPixels][,lerpX][,lerpY])
        this.cameras.main.setDeadzone(20, 20);
        this.cameras.main.setZoom(this.SCALE);
        // Set the background color
        const bgColor = this.cache.tilemap.get("platformer-level-1").data.backgroundcolor;
        console.log("Background color: ", bgColor);
        if (bgColor) this.cameras.main.setBackgroundColor(bgColor);

        this.addButtons();
        this.setupScore();
        this.addObjects();

        // Input handling
        cursors = this.input.keyboard.createCursorKeys();
        this.dKey = this.input.keyboard.addKey('D');
        this.aKey = this.input.keyboard.addKey('A');
        this.spaceKey = this.input.keyboard.addKey('SPACE');

        // Movement vfx
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            random: true,
            scale: {start: 0.03, end: 0.05},
            maxAliveParticles: 3,
            lifespan: 250,
            gravityY: -40,
            duration: 500,
            alpha: {start: 1, end: 0.1}, 
        });

        my.vfx.walking.stop();
    }

    update(time, delta) {
        if (!this.inputLocked) {
            if(cursors.left.isDown || this.aKey.isDown) {
                if (my.sprite.player.body.velocity.x > 0) my.sprite.player.setVelocityX(my.sprite.player.body.velocity.x / 4);
                my.sprite.player.setAccelerationX(-this.ACCELERATION);
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);
                // TODO: add particle following code here
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, my.sprite.player.displayHeight/2-5, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                } 
            } else if(cursors.right.isDown || this.dKey.isDown) {
                if (my.sprite.player.body.velocity.x < 0) my.sprite.player.setVelocityX(my.sprite.player.body.velocity.x / 4);
                my.sprite.player.setAccelerationX(this.ACCELERATION);
                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);
                // TODO: add particle following code here
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, my.sprite.player.displayHeight/2-5, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                }
            } else {
                // Set acceleration to 0 and have DRAG take over
                my.sprite.player.setAccelerationX(0);
                my.sprite.player.setDragX(this.DRAG);
                //my.sprite.player.setVelocityX(0); // stop horizontal movement
                my.sprite.player.anims.play('idle');
                // TODO: have the vfx stop playing
                my.vfx.walking.stop();
            } 
        } else {
            // Set acceleration to 0 and have DRAG take over
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);
            //my.sprite.player.setVelocityX(0); // stop horizontal movement
            my.sprite.player.anims.play('idle');
            // TODO: have the vfx stop playing
            my.vfx.walking.stop();
        }

        // Track how many consecutive frames the player is grounded
        if (my.sprite.player.body.blocked.down) {
            this.coyoteTime = this.COYOTE_DURATION;
            this.hasJumped = false;
        } else {
            this.groundedFrames = 0;
            this.coyoteTime -= delta;
        }

        if (Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.jumpBufferRemaining = this.JUMP_BUFFER_DURATION;
        else this.jumpBufferRemaining -= delta; // decrement jump buffer time

        // player jump
        // note that we need body.blocked rather than body.touching b/c the former applies to tilemap tiles and the latter to the "ground"
        if(!my.sprite.player.body.blocked.down) {
            my.sprite.player.anims.play('jump');
        }
        if(!this.inputLocked && this.coyoteTime > 0 && this.jumpBufferRemaining > 0 && !this.hasJumped) {
            this.hasJumped = true; // set jump flag to true
            this.coyoteTime = 0; // reset coyote time
            this.jumpBufferRemaining = 0; // reset jump buffer time
            my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
        }

        // Cut jump short if player releases key while still rising
        if (my.sprite.player.body.velocity.y < 0 && !(cursors.up.isDown || this.spaceKey.isDown)) {
            // Cut the jump
            my.sprite.player.setVelocityY(Math.max(my.sprite.player.body.velocity.y, this.JUMP_CUTOFF_VELOCITY));
        }

        // If below world
        if(my.sprite.player.y > this.scale.height) {
            my.sprite.player.setPosition(this.lastSafePosition[0], this.lastSafePosition[1]); // respawn at spawn point
            my.sprite.player.setVelocity(0, 0); // reset velocity
            my.sprite.player.setAcceleration(0, 0); // reset acceleration
            my.sprite.player.setDrag(0, 0); // reset drag
            this.inputLocked = true;
            this.time.delayedCall(200, () => {
                this.inputLocked = false;
            });
        }

        const player = my.sprite.player;

        if (player.body.blocked.down) {
            const tile = this.groundLayer.getTileAtWorldXY(my.sprite.player.x, my.sprite.player.y + my.sprite.player.height / 2);
            //console.log(tile.properties);
            if (tile && tile.properties.safeGround) {
                this.lastSafePosition = [my.sprite.player.x, my.sprite.player.y];
                //console.log("Safe spawn point updated to: ", this.lastSafePosition);
            }
        }
    }

    setupScore() {
        // Save player score
        let playerScore = this.registry.get('playerScore') || 0;
        this.registry.set('playerScore', playerScore);
        
        let xPos = 1140;
        let yPos = 490;
        let fontSize = 12;
        // Add score text
        this.displayScore = this.add.bitmapText(xPos, yPos, 'myFont', 'Score: ' + this.registry.get('playerScore'), fontSize);
        this.displayScore.setScrollFactor(0); // Make it not scroll with the camera

        // Add high score text
        this.displayHighScore = this.add.bitmapText(xPos, yPos + 25, 'myFont', 'High: ' + (parseInt(localStorage.getItem('highScore')) || 0), fontSize);
        this.displayHighScore.setScrollFactor(0); // Make it not scroll with the camera

        // Move to front
        this.displayScore.setDepth(this.UI_DEPTH);
        this.displayHighScore.setDepth(this.UI_DEPTH);
    }

    updateScore(givenPoints) {
        let score = this.registry.get('playerScore') + givenPoints;
        this.registry.set('playerScore', score);
        this.displayScore.setText('Score: ' + this.registry.get('playerScore'));
    }

    addButtons() {
        // Restart game button
        // Create a semi-transparent overlay
        this.buttonRect = this.add.rectangle(this.scale.width/2, this.scale.height/2 + 20, 200, 60, 0x000000, 0.5);
        this.buttonRect.setOrigin(0.5, 0.5);
        this.buttonRect.setScrollFactor(0); // Make it not scroll with the camera
        this.buttonRect.setVisible(false); // Hide the rectangle initially
        this.buttonRect.setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        // Display "Game Over" text
        this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, "Game over", {
            fontSize: "32px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 5
        }).setOrigin(0.5);
        this.gameOverText.setVisible(false); // Hide the text initially
        this.gameOverText.setScrollFactor(0); // Make it not scroll with the camera

        // Restart button
        this.restartButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, "Play Again", {
            fontSize: "24px",
            backgroundColor: "#ffffff",
            color: "#000000",
            padding: { x: 20, y: 10 } // Add padding around the text
        })
        .setInteractive()
        .on('pointerdown', () => {
            this.restartGame();
        });
        this.restartButton.setOrigin(0.5, 0.5);
        this.restartButton.setScrollFactor(0); // Make it not scroll with the camera
        this.restartButton.setVisible(false); // Hide the button initially
        this.restartButton.setInteractive(false); // Disable interaction initially
        this.restartButton.setDepth(this.UI_DEPTH); // Ensure it appears above other elements
    }

    addObjects() {
        // TODO: Add createFromObjects here
        // Find coins in the "Objects" layer in Phaser
        // Look for them by finding objects with the name "coin"
        // Assign the coin texture from the tilemap_sheet sprite sheet
        // Phaser docs:
        // https://newdocs.phaser.io/docs/3.80.0/focus/Phaser.Tilemaps.Tilemap-createFromObjects

        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });

        this.diamonds = this.map.createFromObjects("Objects", {
            name: "diamond",
            key: "tilemap_sheet",
            frame: 67
        });

        this.endFlag = this.map.createFromObjects("Objects", {
            name: "flag",
            key: "tilemap_sheet",
            frame: 111
        });
        
        // TODO: Add turn into Arcade Physics here
        // Since createFromObjects returns an array of regular Sprites, we need to convert 
        // them into Arcade Physics sprites (STATIC_BODY, so they don't move) 
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.diamonds, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.endFlag, Phaser.Physics.Arcade.STATIC_BODY);

        // Create a Phaser group out of the array this.coins
        // This will be used for collision detection below.
        this.coinGroup = this.add.group(this.coins);
        this.diamondGroup = this.add.group(this.diamonds);
        this.endFlag = this.add.group(this.endFlag);

        // TODO: Add coin collision handler
        // Handle collision detection with coins
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
            obj2.destroy(); // remove coin on overlap
            this.updateScore(1); // increment score
        });
        this.physics.add.overlap(my.sprite.player, this.diamondGroup, (obj1, obj2) => {
            obj2.destroy(); // remove diamond on overlap
            this.updateScore(5); // increment score
        });
        this.physics.add.overlap(my.sprite.player, this.endFlag, (obj1, obj2) => {
            if (!this.isGameOver) {
                this.isGameOver = true; // prevent multiple triggers
                console.log("You reached the end! Final Score: " + this.score);
                this.gameOver("You win!");

            }
        });

        // Play animations
        this.coinGroup.getChildren().forEach(coin => {
            coin.anims.play('coinSpin');
        });
        this.endFlag.getChildren().forEach(flag => {
            flag.anims.play('flagWave');
        });

        // Diamond bob
        this.diamondGroup.getChildren().forEach(diamond => {
            this.tweens.add({ 
                targets: diamond, 
                y: diamond.y - 3, 
                duration: 400, 
                yoyo: true, 
                repeat: -1, 
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 500) // random stagger up to 300ms
            });
        });

    }

    gameOver(text="Game Over") {
        this.buttonRect.setVisible(true); // Show the overlay

        this.gameOverText.setText(text); // Set the text
        this.gameOverText.setVisible(true); // Show the text

        this.restartButton.setVisible(true); // Show the button
        this.restartButton.setInteractive(true); // Enable interaction
        this.inputLocked = true;
    }

    restartGame() {
        this.buttonRect.setVisible(false); // Hide the overlay
        
        this.gameOverText.setVisible(false); // Hide the text

        this.restartButton.setVisible(false); // Hide the button
        this.restartButton.setInteractive(false); // Disable interaction

        let playerScore = this.registry.get('playerScore');
        // Check if the player score is greater than the high score
        if (playerScore > parseInt(localStorage.getItem('highScore')) || !localStorage.getItem('highScore')) {
            localStorage.setItem('highScore', playerScore);
            this.displayHighScore.setText('High: ' + parseInt(localStorage.getItem('highScore')));
        }

        this.registry.set('playerScore', 0);
        this.scene.stop("level1");
        this.scene.start("level1");
    }
}