import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Howl, Howler } from 'howler'; // 引入 Howler.js 庫

// Tailwind CSS is assumed to be available.

const PIXEL_SCALE = 2.1; // 用於放大遊戲畫面，讓像素風格更明顯

// 遊戲常量
const GAME_DURATION = 10 * 60 * 1000; // 10分鐘 (毫秒)
const PLAYER_RADIUS = 16;
const ENEMY_RADIUS = 12;
const EXP_GEM_RADIUS = 8;
const BASE_MAGNET_RADIUS = 60; // 基礎經驗寶石吸取範圍

// 霹靂布袋戲角色及元素設定
const PILI_CHARACTER = {
  name: "秦假仙",
  icon: "✨", // 代表秦假仙
  health: 99999, // 將生命值調回正常，方便測試
  speed: 0.03, // 降低初始速度
  magnetRadius: BASE_MAGNET_RADIUS, // 初始磁力範圍
  invincibilityDuration: 3000, // 初始無敵時間 (毫秒)
};

const PILI_ENEMIES = [
  { name: "妖道角", icon: "�", speed: 0.01, health: 100, exp: 15, color: "bg-gray-700" }, // 降低妖道角速度
  { name: "魔兵", icon: "👹", speed: 0.012, health: 200, exp: 30, color: "bg-red-800" },
  { name: "羅喉部眾", icon: "👿", speed: 0.013, health: 300, exp: 60, color: "bg-purple-900" }, // 新增敵人
];

const PILI_WEAPONS = [
  {
    id: 'weapon-fu-chen',
    name: "鬼氣貫腦",
    icon: "💨",
    type: "melee", // 近戰範圍攻擊
    damage: 100, // 調整初始傷害，確保能擊殺敵人
    cooldown: 1000, // 毫秒
    radius: 160, // 攻擊範圍
    description: "鬼氣貫腦範圍內敵人受損。",
    level: 1,
    maxLevel: 5,
    upgrades: [
      { damage: 20, cooldown: -100, radius: 20, description: "提升傷害與範圍" },
      { damage: 30, cooldown: -100, radius: 20, description: "提升傷害與範圍" },
      { damage: 40, cooldown: -100, radius: 20, description: "提升傷害與範圍" },
      { damage: 50, cooldown: -100, radius: 20, description: "提升傷害與範圍" },
    ]
  },
  {
    id: 'weapon-jian-qi',
    name: "達摩一指插",
    icon: "🗡️",
    type: "projectile", // 投射物攻擊
    damage: 150,
    cooldown: 2000,
    speed: 5,
    count: 1, // 每次發射數量
    projectileRadius: 15, // 投射物半徑加大
    description: "發射一道刀氣穿透敵人。",
    level: 1,
    maxLevel: 5,
    upgrades: [
      { damage: 50, cooldown: -200, count: 2, description: "提升傷害與數量" },
      { damage: 50, cooldown: -200, count: 4, description: "提升傷害與數量" },
      { damage: 50, cooldown: -200, count: 6, description: "提升傷害與數量" },
      { damage: 50, cooldown: -200, count: 8, description: "提升傷害與數量" },
    ]
  },
    {
    id: 'passive-light-foot',
    name: "輕功",
    icon: "👟",
    type: "passive", // 被動技能
    effect: { speed: 0.01 },
    description: "提升移動速度。",
    level: 1,
    maxLevel: 3,
    upgrades: [
      { effect: { speed: 0.05 }, description: "提升移動速度" },
      { effect: { speed: 0.05 }, description: "提升移動速度" },
    ]
  },
  {
    id: 'passive-magnet-aura',
    name: "天罡真氣", // 新增被動技能
    icon: "🧲",
    type: "passive",
    effect: { magnetRadius: 200 },
    description: "擴大經驗寶石吸取範圍。",
    level: 1,
    maxLevel: 3,
    upgrades: [
      { effect: { magnetRadius: 200 }, description: "擴大經驗寶石吸取範圍" },
      { effect: { magnetRadius: 200 }, description: "擴大經驗寶石吸取範圍" },
    ]
  },
];

const App = () => {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef();
  const lastUpdateTimeRef = useRef(0);
  const inputRef = useRef({ w: false, a: false, s: false, d: false });
  const playerMovementSoundCooldownRef = useRef(0); // For player movement sound

  // 設置音效對象
  const sounds = useRef({});
  useEffect(() => {
    // 初始化所有音效。請將 'path/to/your/sound.mp3' 替換為您的實際音效檔案路徑。
    // 音效檔案應放置在 public 資料夾下的 'sounds' 子資料夾中，例如 'public/sounds/game_start.mp3'。
    // 在這裡直接使用相對路徑，Create React App 會在建構時處理這些路徑。
    const getSoundPath = (filename) => `/sounds/${filename}`; // 修正：移除 process.env.PUBLIC_URL

    sounds.current = {
      gameStart: new Howl({ src: [getSoundPath('game_start.mp3')], volume: 0.5 }),
      playerMove: new Howl({ src: [getSoundPath('player_move.mp3')], volume: 0.1, rate: 1.2 }), // 腳步聲可調低音量和播放速度
      enemySpawn: new Howl({ src: [getSoundPath('enemy_spawn.mp3')], volume: 0.3 }),
      meleeAttack: new Howl({ src: [getSoundPath('melee_attack.mp3')], volume: 0.6 }),
      projectileCast: new Howl({ src: [getSoundPath('projectile_cast.mp3')], volume: 0.7 }),
      projectileHit: new Howl({ src: [getSoundPath('projectile_hit.mp3')], volume: 0.4 }),
      enemyDeath: new Howl({ src: [getSoundPath('enemy_death.mp3')], volume: 0.5 }),
      playerHurt: new Howl({ src: [getSoundPath('player_hurt.mp3')], volume: 0.8 }),
      gemCollect: new Howl({ src: [getSoundPath('gem_collect.mp3')], volume: 0.5 }),
      levelUp: new Howl({ src: [getSoundPath('level_up.mp3')], volume: 0.7 }),
      gameWin: new Howl({ src: [getSoundPath('game_win.mp3')], volume: 0.9 }),
      gameOver: new Howl({ src: [getSoundPath('game_over.mp3')], volume: 0.9, loop: false }), // 遊戲結束音樂通常不循環
      backgroundMusic: new Howl({ src: [getSoundPath('bg_music.mp3')], volume: 0.3, loop: true }) // 背景音樂循環播放
    };

    // Howler.js 需要用戶互動才能播放。通常在遊戲開始按鈕點擊後播放背景音樂。
    // 在這裡不自動播放，因為遊戲啟動邏輯會處理。

    // 清理函數：組件卸載時停止所有音效
    return () => {
      Howler.stop();
      for (const key in sounds.current) {
        if (sounds.current[key] && sounds.current[key].unload) {
          sounds.current[key].unload(); // 釋放音效資源
        }
      }
    };
  }, []); // 空依賴陣列表示只運行一次

  const playSound = useCallback((soundName) => {
    // 只有當音效存在且沒有在播放時才播放（對於非循環音效）
    if (sounds.current[soundName] && !sounds.current[soundName].playing()) {
      sounds.current[soundName].play();
      console.log(`PLAY_SOUND: ${soundName}`); // 同時在控制台輸出，方便調試
    } else if (sounds.current[soundName]) {
        // 對於循環音效如背景音樂，如果已經在播放就不重複調用 play()
        // 對於其他音效，如果頻繁調用可能會被截斷，但對於單次事件觸發的音效是沒問題的
        console.log(`PLAY_SOUND: ${soundName} (already playing or queued)`);
    } else {
        console.warn(`PLAY_SOUND: Sound ${soundName} not found.`);
    }
  }, []);

  const stopSound = useCallback((soundName) => {
    if (sounds.current[soundName]) {
      sounds.current[soundName].stop();
    }
  }, []);

  const stopAllSounds = useCallback(() => {
    Howler.stop(); // 停止所有正在播放的 Howler 音效
  }, []);


  const [player, setPlayer] = useState({
    x: 0,
    y: 0,
    health: PILI_CHARACTER.health,
    maxHealth: PILI_CHARACTER.health,
    speed: PILI_CHARACTER.speed,
    experience: 0,
    level: 1,
    weapons: [], // 玩家擁有的武器實例
    passiveEffects: {}, // 被動技能影響
    magnetRadius: PILI_CHARACTER.magnetRadius, // 磁力範圍
    invincibilityTimer: 0, // 無敵時間計時器
    hitFlashTimer: 0, // 受擊閃爍計時器
  });

  const [enemies, setEnemies] = useState([]);
  const [expGems, setExpGems] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [gameState, setGameState] = useState('menu'); // menu, playing, levelUp, gameOver, gameWin
  const [levelUpOptions, setLevelUpOptions] = useState([]);
  const [gameTime, setGameTime] = useState(0); // 遊戲時間 (毫秒)
  const [score, setScore] = useState(0); // 消滅敵人數量
  const [activeAttackVisuals, setActiveAttackVisuals] = useState([]); // 存儲攻擊視覺效果

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // 設置畫布尺寸
  useEffect(() => {
    const updateCanvasDimensions = () => {
      const parent = canvasRef.current?.parentElement;
      if (parent) {
        setCanvasDimensions({
          width: parent.clientWidth * PIXEL_SCALE,
          height: parent.clientHeight * PIXEL_SCALE,
        });
        // 設置玩家初始位置為中心
        setPlayer(prev => ({
          ...prev,
          x: parent.clientWidth / 2 * PIXEL_SCALE,
          y: parent.clientHeight / 2 * PIXEL_SCALE,
        }));
      }
    };

    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, []);

  // 遊戲開始
  const startGame = useCallback(() => {
    setPlayer({
      x: canvasDimensions.width / 2,
      y: canvasDimensions.height / 2,
      health: PILI_CHARACTER.health,
      maxHealth: PILI_CHARACTER.health,
      speed: PILI_CHARACTER.speed,
      experience: 0,
      level: 1,
      weapons: [{ ...PILI_WEAPONS[0], lastFired: 0 }], // 初始武器：拂塵
      passiveEffects: {},
      magnetRadius: PILI_CHARACTER.magnetRadius, // 重置磁力範圍
      invincibilityTimer: PILI_CHARACTER.invincibilityDuration, // 設定初始無敵時間
      hitFlashTimer: 0, // 重置受擊閃爍計時器
    });
    setEnemies([]);
    setExpGems([]);
    setProjectiles([]);
    setGameTime(0);
    setScore(0);
    setActiveAttackVisuals([]); // 重置攻擊視覺效果
    setGameState('playing');
    lastUpdateTimeRef.current = performance.now();
    // 遊戲開始音效
    playSound('gameStart');
    playSound('backgroundMusic'); // 播放背景音樂
  }, [canvasDimensions.width, canvasDimensions.height, playSound]);

  // 生成新的敵人
  const spawnEnemy = useCallback(() => {
    let x, y;
    const padding = 50; // 確保敵人從畫面外生成
    const minSpawnDistance = 350; // 增加最小生成距離

    // Loop until a valid spawn position is found
    let validSpawn = false;
    do {
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      if (edge === 0) { // Top
        x = Math.random() * canvasDimensions.width;
        y = -padding;
      } else if (edge === 1) { // Right
        x = canvasDimensions.width + padding;
        y = Math.random() * canvasDimensions.height;
      } else if (edge === 2) { // Bottom
        x = Math.random() * canvasDimensions.width;
        y = canvasDimensions.height + padding;
      } else { // Left
        x = -padding;
        y = Math.random() * canvasDimensions.height;
      }
      validSpawn = Math.hypot(x - player.x, y - player.y) >= minSpawnDistance;
    } while (!validSpawn);

    // 隨時間增加生成難度
    let enemyTypeIndex = 0;
    if (gameTime > GAME_DURATION * 0.3) { // 30% 時間後開始出現魔兵
      enemyTypeIndex = Math.floor(Math.random() * (PILI_ENEMIES.length > 1 ? 2 : 1)); // 0 或 1
    }
    if (gameTime > GAME_DURATION * 0.6) { // 60% 時間後開始出現羅喉部眾
      enemyTypeIndex = Math.floor(Math.random() * PILI_ENEMIES.length); // 0, 1 或 2
    }
    const enemyType = PILI_ENEMIES[enemyTypeIndex];

    setEnemies(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x, y,
        health: enemyType.health,
        maxHealth: enemyType.health,
        speed: enemyType.speed,
        type: enemyType.name,
        icon: enemyType.icon,
        color: enemyType.color,
        expValue: enemyType.exp,
      }
    ]);
    playSound('enemySpawn'); // 敵人生成音效
  }, [canvasDimensions, gameTime, player, playSound]);

  // 處理玩家升級
  const handleLevelUp = useCallback(() => {
    playSound('levelUp'); // 升級音效
    const availableWeapons = PILI_WEAPONS.filter(w => {
      const existingWeapon = player.weapons.find(pw => pw.id === w.id);
      return !existingWeapon || existingWeapon.level < w.maxLevel;
    });

    const choices = [];
    const chosenIndices = new Set(); // 確保不重複選擇

    while (choices.length < 3 && choices.length < availableWeapons.length) {
      const randomIndex = Math.floor(Math.random() * availableWeapons.length);
      if (!chosenIndices.has(randomIndex)) {
        choices.push(availableWeapons[randomIndex]);
        chosenIndices.add(randomIndex);
      }
    }
    if (choices.length === 0) { // 如果沒有可選的升級，可能已達上限
        // 可以選擇給予回復生命或額外金幣等
        choices.push({ id: 'heal-hp', name: '回復生命', icon: '❤️', description: '回復 30 點生命值。', type: 'utility' });
    }

    setLevelUpOptions(choices);
    setGameState('levelUp');
  }, [player.weapons, playSound]);

  // 選擇升級選項
  const chooseUpgrade = useCallback((selectedOption) => {
    setPlayer(prevPlayer => {
      // 處理特殊選項，例如回復生命
      if (selectedOption.id === 'heal-hp') {
        const newHealth = Math.min(prevPlayer.maxHealth, prevPlayer.health + 30);
        playSound('healthRecover'); // 生命回復音效
        return { ...prevPlayer, health: newHealth };
      }

      const existingWeaponIndex = prevPlayer.weapons.findIndex(w => w.id === selectedOption.id);
      let updatedWeapons = [...prevPlayer.weapons];
      let newSpeed = prevPlayer.speed;
      let newMagnetRadius = prevPlayer.magnetRadius;

      if (existingWeaponIndex !== -1) {
        // 升級現有武器或被動技能
        const currentWeapon = updatedWeapons[existingWeaponIndex];
        if (currentWeapon.level < currentWeapon.maxLevel) {
          const upgrade = currentWeapon.upgrades[currentWeapon.level - 1]; // 獲取對應等級的升級
          const newLevel = currentWeapon.level + 1;
          const updatedWeapon = {
            ...currentWeapon,
            level: newLevel,
            damage: (currentWeapon.damage || 0) + (upgrade.damage || 0),
            cooldown: (currentWeapon.cooldown || 0) + (upgrade.cooldown || 0),
            radius: (currentWeapon.radius || 0) + (upgrade.radius || 0),
            speed: (currentWeapon.speed || 0) + (upgrade.speed || 0),
            count: (currentWeapon.count || 0) + (upgrade.count || 0),
          };
          updatedWeapons[existingWeaponIndex] = updatedWeapon;

          if (selectedOption.type === "passive" && upgrade.effect) {
            newSpeed += upgrade.effect.speed || 0;
            newMagnetRadius += upgrade.effect.magnetRadius || 0;
          }
        }
      } else {
        // 獲得新武器或被動技能
        const newWeaponInstance = { ...selectedOption, lastFired: 0 };
        updatedWeapons.push(newWeaponInstance);
        if (selectedOption.type === "passive" && selectedOption.effect) {
          newSpeed += selectedOption.effect.speed || 0;
          newMagnetRadius += selectedOption.effect.magnetRadius || 0;
        }
      }
      return {
        ...prevPlayer,
        weapons: updatedWeapons,
        speed: newSpeed, // 更新玩家總速度
        magnetRadius: newMagnetRadius, // 更新玩家磁力範圍
      };
    });
    setGameState('playing');
  }, []);


  // 遊戲主循環
  const gameLoop = useCallback((currentTime) => {
    if (gameState !== 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const deltaTime = currentTime - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = currentTime;
    setGameTime(prev => prev + deltaTime);

    // 更新玩家無敵時間和受擊閃爍計時器
    setPlayer(prevPlayer => ({
      ...prevPlayer,
      invincibilityTimer: Math.max(0, prevPlayer.invincibilityTimer - deltaTime),
      hitFlashTimer: Math.max(0, prevPlayer.hitFlashTimer - deltaTime),
    }));

    // 清除過期的攻擊視覺效果
    setActiveAttackVisuals(prev => prev.filter(v => currentTime - v.startTime < v.duration));


    if (gameTime >= GAME_DURATION) {
      setGameState('gameWin'); // 遊戲勝利
      playSound('gameWin'); // 遊戲勝利音效
      stopAllSounds(); // 停止所有音效
      setEnemies([]); // 清除所有敵人
      setExpGems([]); // 清除所有經驗寶石
      setProjectiles([]); // 清除所有投射物
      setActiveAttackVisuals([]); // 清除所有攻擊視覺效果
      return;
    }

    // 1. 處理輸入與玩家移動
    setPlayer(prevPlayer => {
      let newX = prevPlayer.x;
      let newY = prevPlayer.y;
      const effectiveSpeed = prevPlayer.speed; // 被動技能已經直接更新了player.speed
      let moved = false;

      if (inputRef.current.w) { newY -= effectiveSpeed; moved = true; }
      if (inputRef.current.s) { newY += effectiveSpeed; moved = true; }
      if (inputRef.current.a) { newX -= effectiveSpeed; moved = true; }
      if (inputRef.current.d) { newX += effectiveSpeed; moved = true; }

      // 播放移動音效 (有冷卻時間)
      if (moved && currentTime - playerMovementSoundCooldownRef.current > 100) { // 每100毫秒播放一次腳步聲
          playSound('playerMove');
          playerMovementSoundCooldownRef.current = currentTime;
      }


      // 邊界限制
      newX = Math.max(PLAYER_RADIUS, Math.min(newX, canvasDimensions.width - PLAYER_RADIUS));
      newY = Math.max(PLAYER_RADIUS, Math.min(newY, canvasDimensions.height - PLAYER_RADIUS));

      return { ...prevPlayer, x: newX, y: newY };
    });

    // 2. 敵人生成 (依時間遞增難度)
    // 遊戲時間越長，敵人生成間隔越短，種類也更強
    const baseSpawnInterval = 1000; // 基礎生成間隔
    const difficultyFactor = Math.max(0.1, 1 - gameTime / GAME_DURATION * 0.9); // 0.1 到 1
    const currentSpawnInterval = baseSpawnInterval * difficultyFactor;

    if (Math.random() < (deltaTime / currentSpawnInterval)) {
      spawnEnemy();
    }


    // 3. 敵人移動與玩家碰撞
    setEnemies(prevEnemies => {
      const newEnemies = [];
      let playerDamageTaken = 0; // 記錄本次循環玩家受到的總傷害

      prevEnemies.forEach(enemy => {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.x += enemy.speed * Math.cos(angle);
        enemy.y += enemy.speed * Math.sin(angle);

        // 玩家與敵人碰撞檢測
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist < PLAYER_RADIUS + ENEMY_RADIUS) {
          playerDamageTaken += 1; // 每次碰撞扣1血
          // 敵人不會因此消失，而是持續對玩家造成傷害
        }
        newEnemies.push(enemy); // 敵人不因碰撞而消失，繼續存在
      });

      // 只有當玩家不在無敵狀態時才計算傷害
      if (playerDamageTaken > 0 && player.invincibilityTimer <= 0) {
        setPlayer(prevPlayer => {
          const newHealth = prevPlayer.health - playerDamageTaken;
          if (newHealth <= 0) {
            setGameState('gameOver');
            playSound('gameOver'); // 遊戲失敗音效
            stopAllSounds(); // 停止所有音效
            setEnemies([]); // 清除所有敵人
            setExpGems([]); // 清除所有經驗寶石
            setProjectiles([]); // 清除所有投射物
            setActiveAttackVisuals([]); // 清除所有攻擊視覺效果
          } else {
            playSound('playerHurt'); // 玩家受傷音效
            // 每次受傷後給予短暫無敵，避免連續傷害
            return { ...prevPlayer, health: newHealth, invincibilityTimer: 500, hitFlashTimer: 200 }; // 受擊後觸發閃爍
          }
          return { ...prevPlayer, health: newHealth };
        });
      }
      return newEnemies;
    });

    // 4. 武器攻擊與投射物邏輯
    setPlayer(prevPlayer => {
      const now = performance.now();
      const updatedWeapons = prevPlayer.weapons.map(weapon => {
        const updatedWeapon = { ...weapon };
        // 確保所有武器都檢查冷卻時間並觸發攻擊
        if (now - weapon.lastFired > weapon.cooldown) {
          if (weapon.type === 'melee') {
            // 拂塵攻擊 (範圍傷害)
            playSound('meleeAttack');
            setActiveAttackVisuals(prev => [...prev, {
                id: Date.now(),
                type: 'melee_flash',
                x: player.x,
                y: player.y,
                radius: weapon.radius,
                startTime: now,
                duration: 250, // 閃爍持續250毫秒 (增加持續時間)
            }]);

            setEnemies(prevEnemies => prevEnemies.filter(enemy => {
              const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
              if (dist < weapon.radius + ENEMY_RADIUS) {
                enemy.health -= weapon.damage;
              }
              if (enemy.health <= 0) {
                setScore(s => s + 1);
                setExpGems(prevGems => [...prevGems, {
                  id: Date.now() + Math.random(),
                  x: enemy.x,
                  y: enemy.y,
                  value: enemy.expValue,
                  color: "bg-green-500",
                }]);
                playSound('enemyDeath'); // 敵人死亡音效
                return false; // 移除死亡敵人
              }
              return true;
            }));
            updatedWeapon.lastFired = now;
          } else if (weapon.type === 'projectile') {
            // 劍氣攻擊 (生成投射物)
            playSound('projectileCast');
            // 新增劍氣發招視覺效果
            setActiveAttackVisuals(prev => [...prev, {
                id: Date.now(),
                type: 'projectile_cast',
                x: player.x,
                y: player.y,
                radius: PLAYER_RADIUS * 2, // 藍色光暈範圍
                startTime: now,
                duration: 200, // 光暈持續時間
            }]);

            // 找到最近的敵人作為目標
            let closestEnemy = null;
            let minDist = Infinity;
            enemies.forEach(enemy => {
              const dist = Math.hypot(player.x - enemy.x, player.y - enemy.x);
              if (dist < minDist) {
                minDist = dist;
                closestEnemy = enemy;
              }
            });

            if (closestEnemy) {
              for (let i = 0; i < weapon.count; i++) {
                const angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x) + (Math.random() - 0.5) * 0.2; // 稍微隨機方向
                setProjectiles(prev => [...prev, {
                  id: Date.now() + Math.random() + i,
                  x: player.x,
                  y: player.y,
                  dx: Math.cos(angle) * weapon.speed,
                  dy: Math.sin(angle) * weapon.speed,
                  damage: weapon.damage,
                  radius: weapon.projectileRadius || 10, // 使用武器定義的半徑，或默認10
                }]);
              }
            }
            updatedWeapon.lastFired = now;
          }
        }
        return updatedWeapon;
      });
      return { ...prevPlayer, weapons: updatedWeapons };
    });

    // 投射物移動與敵人碰撞
    setProjectiles(prevProjectiles => {
      const newProjectiles = [];
      setEnemies(prevEnemies => {
        const updatedEnemies = [...prevEnemies];
        prevProjectiles.forEach(proj => {
          proj.x += proj.dx;
          proj.y += proj.dy;

          let hitEnemy = false;
          for (let i = 0; i < updatedEnemies.length; i++) {
            const enemy = updatedEnemies[i];
            const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
            // 檢查是否命中敵人
            if (dist < proj.radius + ENEMY_RADIUS) {
              enemy.health -= proj.damage;
              playSound('projectileHit'); // 劍氣擊中音效
              if (enemy.health <= 0) {
                setScore(s => s + 1);
                setExpGems(prevGems => [...prevGems, {
                  id: Date.now() + Math.random(),
                  x: enemy.x,
                  y: enemy.y,
                  value: enemy.expValue,
                  color: "bg-green-500",
                }]);
                playSound('enemyDeath'); // 敵人死亡音效
                updatedEnemies.splice(i, 1); // 移除死亡敵人
                i--; // 調整索引以正確迭代
              }
              hitEnemy = true; // 投射物命中，將被移除
              break; // 投射物通常只命中一個敵人（除非有穿透效果）
            }
          }
          // 如果投射物未命中敵人且仍在畫面內，則保留
          if (!hitEnemy && proj.x > -proj.radius && proj.x < canvasDimensions.width + proj.radius &&
              proj.y > -proj.radius && proj.y < canvasDimensions.height + proj.radius) {
            newProjectiles.push(proj);
          }
        });
        return updatedEnemies;
      });
      return newProjectiles;
    });

    // 5. 經驗寶石收集 (加入磁力效果)
    setExpGems(prevGems => prevGems.filter(gem => {
      const distToPlayer = Math.hypot(player.x - gem.x, player.y - gem.y);

      if (distToPlayer < PLAYER_RADIUS + EXP_GEM_RADIUS) {
        // 直接接觸拾取
        setPlayer(prevPlayer => {
          const newExp = prevPlayer.experience + gem.value;
          const expToNextLevel = prevPlayer.level * 100; // 簡化升級所需經驗

          if (newExp >= expToNextLevel) {
            handleLevelUp();
            return {
              ...prevPlayer,
              experience: newExp - expToNextLevel,
              level: prevPlayer.level + 1,
            };
          }
          return { ...prevPlayer, experience: newExp };
        });
        playSound('gemCollect');
        return false; // 移除已收集的寶石
      } else if (distToPlayer < player.magnetRadius) {
        // 磁力吸取
        const angle = Math.atan2(player.y - gem.y, player.x - gem.x);
        const magnetSpeed = Math.max(2, distToPlayer / 10); // 距離越近吸取越快
        gem.x += magnetSpeed * Math.cos(angle);
        gem.y += magnetSpeed * Math.sin(angle);
        return true; // 寶石仍在被吸取中
      }
      return true; // 寶石未被收集且不在磁力範圍內
    }));

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, gameTime, player, enemies, spawnEnemy, handleLevelUp, canvasDimensions.width, canvasDimensions.height, playSound, stopAllSounds]);

  // 渲染遊戲畫面
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製背景 (簡化為深藍色，模仿夜晚或魔界背景)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 繪製玩家 (素還真)
    // 無敵狀態下閃爍效果
    const playerOpacity = (player.invincibilityTimer > 0 && Math.floor(gameTime / 100) % 2 === 0) ? 0.4 : 1;
    let playerColor = '#fde047'; // 默認黃色
    // 受擊閃爍效果 (獨立於無敵閃爍，受傷優先顯示紅色)
    if (player.hitFlashTimer > 0) {
        const flashAlpha = player.hitFlashTimer / 200; // 根據計時器調整透明度
        playerColor = `rgba(255, 0, 0, ${flashAlpha})`; // 受傷時顯示紅色
        ctx.globalAlpha = 1; // 受傷時強制不透明度為1，覆蓋無敵閃爍的透明度
    } else {
        ctx.globalAlpha = playerOpacity; // 恢復無敵或正常透明度
    }

    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${PLAYER_RADIUS * 1.5}px serif`; // 更大的字體
    ctx.fillText(PILI_CHARACTER.icon, player.x, player.y + 2); // 調整字體垂直置中
    ctx.globalAlpha = 1; // 恢復透明度

    // 繪製經驗寶石磁力範圍 (僅用於視覺參考，實際遊戲中通常不顯示)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // 半透明白色
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.magnetRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 繪製攻擊視覺效果
    activeAttackVisuals.forEach(visual => {
        const alpha = 1 - (gameTime - visual.startTime) / visual.duration;
        if (visual.type === 'melee_flash') {
            ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`; // 金色閃光
            ctx.lineWidth = 5; // 更粗的線條
            ctx.beginPath();
            ctx.arc(visual.x, visual.y, visual.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (visual.type === 'projectile_cast') {
            ctx.strokeStyle = `rgba(100, 149, 237, ${alpha})`; // 藍色光暈
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(visual.x, visual.y, visual.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    });

    // 繪製敵人
    enemies.forEach(enemy => {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, ENEMY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${ENEMY_RADIUS * 1.5}px serif`;
      ctx.fillText(enemy.icon, enemy.x, enemy.y + 2);

      // 敵人血條
      ctx.fillStyle = '#555';
      ctx.fillRect(enemy.x - ENEMY_RADIUS, enemy.y - ENEMY_RADIUS - 10, ENEMY_RADIUS * 2, 3);
      ctx.fillStyle = 'red';
      ctx.fillRect(enemy.x - ENEMY_RADIUS, enemy.y - ENEMY_RADIUS - 10, ENEMY_RADIUS * 2 * (enemy.health / enemy.maxHealth), 3);
    });

    // 繪製經驗寶石
    expGems.forEach(gem => {
      ctx.fillStyle = gem.color;
      ctx.beginPath();
      ctx.arc(gem.x, gem.y, EXP_GEM_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    // 繪製投射物
    projectiles.forEach(proj => {
      ctx.fillStyle = 'blue'; // 劍氣顏色
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
    });


  }, [player, enemies, expGems, projectiles, gameTime, activeAttackVisuals]); // 增加 activeAttackVisuals 作為依賴

  // 遊戲啟動與循環管理
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      const animationId = gameLoopRef.current;
      return () => {
        cancelAnimationFrame(animationId);
      };
    } else {
        stopSound('backgroundMusic'); // 遊戲非 playing 狀態時停止背景音樂
    }
  }, [gameState, gameLoop, stopSound]); // 將 stopSound 加入依賴

  // 繪製更新
  useEffect(() => {
    drawGame();
  }, [player, enemies, expGems, projectiles, gameState, drawGame]);


  // 鍵盤事件監聽
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState === 'playing' || gameState === 'gameOver' || gameState === 'gameWin') { // 在這些狀態下可以移動或重啟
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') inputRef.current.w = true;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') inputRef.current.a = true;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') inputRef.current.s = true;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') inputRef.current.d = true;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') inputRef.current.w = false;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') inputRef.current.a = false;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') inputRef.current.s = false;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') inputRef.current.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);


  // 時間格式化
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getExperienceProgress = () => {
    const expToNextLevel = player.level * 100;
    if (expToNextLevel === 0) return 0; // 避免除以零
    return (player.experience / expToNextLevel) * 100;
  };

  const getHealthProgress = () => {
    return (player.health / player.maxHealth) * 100;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white font-inter p-4">
      <h1 className="text-4xl font-bold mb-6 text-yellow-300 drop-shadow-lg">
        霹靂倖存者：秦假仙
      </h1>

      <div className="relative w-full max-w-4xl aspect-video bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasDimensions.width}
          height={canvasDimensions.height}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }} // 讓像素更清晰
        />

        {/* 遊戲介面 */}
        {gameState === 'playing' && (
          <div className="absolute top-4 left-4 p-3 bg-black bg-opacity-70 rounded-md shadow-lg text-sm space-y-2">
            <div>時間：{formatTime(gameTime)} / {formatTime(GAME_DURATION)}</div>
            <div>消滅數：{score}</div>
            <div>等級：{player.level}</div>
            {/* 血條 */}
            <div className="w-40 bg-red-900 rounded-full h-3">
              <div
                className="bg-red-500 h-3 rounded-full transition-all duration-100"
                style={{ width: `${getHealthProgress()}%` }}
              ></div>
            </div>
            <div className="text-xs">生命：{player.health} / {player.maxHealth}</div>

            {/* 經驗條 */}
            <div className="w-40 bg-blue-900 rounded-full h-3 mt-1">
              <div
                className="bg-blue-400 h-3 rounded-full transition-all duration-100"
                style={{ width: `${getExperienceProgress()}%` }}
              ></div>
            </div>
            <div className="text-xs">經驗：{player.experience} / {player.level * 100}</div>

            {/* 武器列表 */}
            <div className="mt-4">
              <h3 className="font-semibold text-yellow-200">當前招式：</h3>
              <ul className="text-xs">
                {player.weapons.map(w => (
                  <li key={w.id}>
                    {w.icon} {w.name} (Lv.{w.level})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 主選單 */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90">
            <h2 className="text-5xl font-extrabold mb-8 text-yellow-400 drop-shadow-2xl">
              霹靂倖存者：秦假仙
            </h2>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-red-600 to-purple-800 text-white font-bold text-2xl rounded-xl shadow-2xl hover:scale-105 transition-transform duration-300 border-2 border-yellow-500"
            >
              啟程！斬妖除魔！
            </button>
            <p className="mt-8 text-lg text-gray-300">
              使用 W A S D 或 方向鍵 移動 秦假仙
            </p>
          </div>
        )}

        {/* 升級選單 */}
        {gameState === 'levelUp' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90">
            <h2 className="text-4xl font-extrabold mb-8 text-yellow-400 drop-shadow-2xl">
              天命加持！選擇你的道！
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {levelUpOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => chooseUpgrade(option)}
                  className="bg-gray-800 hover:bg-gray-700 p-6 rounded-lg shadow-xl border-2 border-yellow-600 hover:border-yellow-400 transition-all duration-200 flex flex-col items-center text-center space-y-2"
                >
                  <span className="text-5xl">{option.icon}</span>
                  <h3 className="text-xl font-bold text-yellow-300">{option.name}</h3>
                  <p className="text-sm text-gray-300">{option.description}</p>
                  <p className="text-xs text-gray-400">
                    {player.weapons.find(w => w.id === option.id) ? `升級至 Lv.${player.weapons.find(w => w.id === option.id).level + 1}` : (option.type === 'utility' ? '' : "新招式")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 遊戲結束畫面 */}
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90">
            <h2 className="text-5xl font-extrabold mb-4 text-red-500 drop-shadow-2xl animate-pulse">
              天命已盡，魔劫難逃！
            </h2>
            <p className="text-2xl text-gray-300 mb-6">
              您堅持了 {formatTime(gameTime)}，消滅了 {score} 個妖魔！
            </p>
            <button
                  onClick={startGame}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-800 text-white font-bold text-2xl rounded-xl shadow-2xl hover:scale-105 transition-transform duration-300 border-2 border-yellow-500"
            >
              再戰一次！
            </button>
          </div>
        )}

        {/* 遊戲勝利畫面 */}
        {gameState === 'gameWin' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90">
            <h2 className="text-5xl font-extrabold mb-4 text-green-400 drop-shadow-2xl animate-pulse">
              阿妹喂！好家在，本仙是殺不死的!
            </h2>
            <p className="text-2xl text-gray-300 mb-6">
              恭喜您在 {formatTime(gameTime)} 的考驗中倖存，消滅了 {score} 個妖魔！
            </p>
            <button
                  onClick={startGame}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-800 text-white font-bold text-2xl rounded-xl shadow-2xl hover:scale-105 transition-transform duration-300 border-2 border-yellow-500"
            >
              再次挑戰！
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-800 bg-opacity-70 rounded-lg text-sm text-gray-300 shadow-xl max-w-2xl text-center">
        <p>
          此為模擬霹靂布袋戲風格的《吸血鬼倖存者》遊戲。
          
        </p>
        <p className="mt-2">
          遊戲採用簡易圖形，聚焦於玩法樂趣。
          未來不會進一步加入更多霹靂人物、專屬招式動畫、多樣的魔族敵人、以及更豐富的場景，請勿期待。
        </p>
      </div>
    </div>
  );
};

export default App;
