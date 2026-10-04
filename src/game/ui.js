// Graphics quality, HUD, input events, touch controls and toasts. Methods are mixed into the game class (see main.js), so `this` is the game.
import { PostFX } from '../atmosphere.js';
import { PERF_TIERS } from '../perf.js';
import { sfx, DAY_SONGS } from './shared.js';

export const uiMethods = {

  // Graphics mode: 'auto' (measure the frame rate and adapt), or a fixed 'high' / 'low'
  loadGraphicsMode() {
    try {
      const saved = localStorage.getItem('gs-graphics');
      if (saved === 'high' || saved === 'low' || saved === 'auto') return saved;
    } catch (e) { /* storage unavailable */ }
    return 'auto';
  },


  // Quality tier to begin with (see PERF_TIERS): phones and tablets start on 'Niedrig'
  startTier() {
    if (this.graphicsMode === 'high') return 0;
    if (this.graphicsMode === 'low') return 1;
    const small = this.isTouch && Math.min(window.innerWidth, window.innerHeight) < 900;
    return small ? 1 : 0;
  },


  applyTier(tier) {
    const t = PERF_TIERS[tier];
    this.perfTier = tier;
    this.graphicsQuality = t.bloom ? 'high' : 'low';
    this.renderScale = t.scale;
    this.applyPixelRatio();
    const shadow = this.dirLight && this.dirLight.shadow;
    if (shadow && shadow.mapSize.x !== t.shadow) {
      shadow.mapSize.set(t.shadow, t.shadow);
      shadow.dispose();
      shadow.map = null;
    }
    // the lowest tier draws no shadows at all (saves a whole extra pass)
    if (this.dirLight) this.dirLight.castShadow = tier < PERF_TIERS.length - 1;
    if (t.bloom && !this.postFX) {
      this.postFX = new PostFX(this.renderer, this.scene, this.camera);
    }
    if (this.postFX) this.postFX.setSize();
    this.updateGraphicsButton();
  },


  applyPixelRatio() {
    const t = PERF_TIERS[this.perfTier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, t.cap) * this.renderScale);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },


  cycleGraphicsMode() {
    const order = ['auto', 'high', 'low'];
    this.graphicsMode = order[(order.indexOf(this.graphicsMode) + 1) % order.length];
    try { localStorage.setItem('gs-graphics', this.graphicsMode); } catch (e) { /* ignore */ }
    this.perf.enabled = this.graphicsMode === 'auto';
    this.perf.arm();
    this.applyTier(this.startTier());
  },


  onAutoTierDown(tier, fps) {
    this.applyTier(tier);
    this.showToast(`🔋 Grafik automatisch angepasst: ${PERF_TIERS[tier].name} (${Math.round(fps)} FPS)`);
  },


  updateGraphicsButton() {
    const btn = document.getElementById('btn-graphics');
    if (!btn) return;
    const name = PERF_TIERS[this.perfTier].name;
    btn.textContent = this.graphicsMode === 'auto' ? `🤖 Grafik: Auto · ${name}`
      : this.graphicsMode === 'high' ? '✨ Grafik: Hoch' : '🔋 Grafik: Niedrig';
  },


  showToast(text, ms = 4000) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  },


  // ==========================================
  // 8. EVENT LISTENERS & UI
  // ==========================================
  setupEvents() {
    this.setupTouchMode();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.postFX) this.postFX.setSize();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return; // typing the player name / room code
      this.keys[e.code] = true;
      if (e.key === '1') this.switchSister(0);
      if (e.key === '2') this.switchSister(1);
      if (e.key === '3') this.switchSister(2);
      if (e.key === '4') this.switchSister(3);
      if (e.key.toLowerCase() === 't') this.coop.toggleWheel();
      if (e.key.toLowerCase() === 'f') this.interactions.trigger();
      if (e.key.toLowerCase() === 'i') this.inventory.toggle();
      if (e.key === 'Escape') this.inventory.toggle(false);
      if (e.key === 'Enter') this.coop.openChat();
      if (e.key === 'Escape') this.coop.toggleWheel(false);
      if (e.key.toLowerCase() === 'q') {
        this.switchSister((this.activeSisterIdx + 1) % 4);
      }
      if (e.key.toLowerCase() === 'e') {
        this.castAbility1();
      }
      if (e.key.toLowerCase() === 'r') {
        this.castAbility2();
      }
      if (e.key.toLowerCase() === 'h') {
        const controlsPopup = document.getElementById('controls-popup');
        const btnHelp = document.getElementById('btn-toggle-help');
        if (controlsPopup) {
          const isHidden = controlsPopup.classList.toggle('hidden');
          if (btnHelp) btnHelp.classList.toggle('active', !isHidden);
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.doJump();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Toggle Controls Popup Dialog
    const controlsPopup = document.getElementById('controls-popup');
    const btnToggleHelp = document.getElementById('btn-toggle-help');
    const btnCloseCtrl = document.getElementById('btn-close-controls');

    if (btnCloseCtrl && controlsPopup) {
      btnCloseCtrl.addEventListener('click', (e) => {
        e.stopPropagation();
        controlsPopup.classList.add('hidden');
        if (btnToggleHelp) btnToggleHelp.classList.remove('active');
        btnCloseCtrl.blur();
      });
    }

    if (btnToggleHelp && controlsPopup) {
      btnToggleHelp.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = controlsPopup.classList.toggle('hidden');
        btnToggleHelp.classList.toggle('active', !isHidden);
        btnToggleHelp.blur();
      });
    }

    document.querySelectorAll('.sister-btn[data-sister]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.sister);
        this.switchSister(idx);
        btn.blur();
      });
    });

    const modal = document.getElementById('boss2-modal');
    const btnBoss2 = document.getElementById('btn-boss2');
    if (btnBoss2) {
      btnBoss2.addEventListener('click', () => {
        modal.classList.add('open');
        btnBoss2.blur();
      });
    }
    const modalClose = document.getElementById('modal-close-btn');
    if (modalClose) {
      modalClose.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }

    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        sfx.enabled = !sfx.enabled;
        soundBtn.textContent = sfx.enabled ? "🔊 Audio: An" : "🔇 Audio: Aus";
        soundBtn.blur();
      });
    }

    const daytimeBtn = document.getElementById('btn-daytime');
    if (daytimeBtn) {
      daytimeBtn.addEventListener('click', () => {
        this.dayNight.skipToNextPhase();
        this.coop.send({ t: 'skipTime' });
        daytimeBtn.blur();
      });
    }

    const graphicsBtn = document.getElementById('btn-graphics');
    if (graphicsBtn) {
      this.updateGraphicsButton();
      graphicsBtn.addEventListener('click', () => {
        this.cycleGraphicsMode();
        graphicsBtn.blur();
      });
    }

    const musicBtn = document.getElementById('btn-music');
    if (musicBtn) {
      const label = () => {
        const cur = DAY_SONGS.find(x => x.key === (sfx.daySong || 'day')) || DAY_SONGS[0];
        musicBtn.textContent = `🎵 Lied: ${cur.name}`;
      };
      label();
      musicBtn.addEventListener('click', () => {
        const idx = DAY_SONGS.findIndex(x => x.key === (sfx.daySong || 'day'));
        const next = DAY_SONGS[(idx + 1) % DAY_SONGS.length];
        sfx.daySong = next.key;
        try { localStorage.setItem('gs-song', next.key); } catch (e) { /* ignore */ }
        label();
        this.showToast(`🎵 Tages-Lied: ${next.name}${this.dayNight.night > 0.55 ? ' (spielt, sobald es Tag ist)' : ''}`, 2500);
        musicBtn.blur();
      });
    }

    const camBtn = document.getElementById('btn-camfollow');
    if (camBtn) {
      const label = () => { camBtn.textContent = this.camFollow ? '🎥 Kamera: folgt' : '🎥 Kamera: frei'; };
      label();
      camBtn.addEventListener('click', () => {
        this.camFollow = !this.camFollow;
        try { localStorage.setItem('gs-camfollow', this.camFollow ? 'on' : 'off'); } catch (e) { /* ignore */ }
        label();
        camBtn.blur();
      });
    }

    const wardrobeBtn = document.getElementById('btn-wardrobe');
    if (wardrobeBtn) {
      wardrobeBtn.addEventListener('click', () => {
        this.progression.cycleSkin();
        wardrobeBtn.blur();
      });
    }

    const fullscreenBtn = document.getElementById('btn-fullscreen');
    if (fullscreenBtn) {
      if (!document.documentElement.requestFullscreen) fullscreenBtn.remove();
      else fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else this.enterFullscreen();
        fullscreenBtn.blur();
      });
    }
  },


  // ---------- Touch devices ----------
  setupTouchMode() {
    const html = document.documentElement;
    const enable = () => {
      html.classList.add('touch');
      this.isTouch = true;
      this.controls.rotateSpeed = 0.7;
    };
    if (this.isTouch) enable();
    // Hybrid devices: switch to the touch layout on the first real touch
    window.addEventListener('touchstart', () => { if (!this.isTouch) enable(); }, { passive: true });

    // Quest / settings panel is a slide-in menu on touch screens
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        const open = html.classList.toggle('menu-open');
        menuBtn.textContent = open ? '✕' : '📜';
        menuBtn.blur();
      });
    }

    // No long-press menu or accidental page gestures while playing
    window.addEventListener('contextmenu', (e) => { if (this.isTouch) e.preventDefault(); });
    ['gesturestart', 'gesturechange'].forEach(t =>
      document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
    window.addEventListener('orientationchange', () => {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
    });
  },


  enterFullscreen() {
    const root = document.documentElement;
    if (!root.requestFullscreen) return;
    root.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => { /* denied or unsupported (e.g. iPhone Safari) */ });
  },


  haptic(ms = 12) {
    if (this.isTouch && navigator.vibrate) navigator.vibrate(ms);
  },


  setupRobloxControls() {
    const btnStart = document.getElementById('btn-start-game');
    const introScreen = document.getElementById('intro-screen');
    if (btnStart && introScreen) {
      const startAdventure = () => {
        sfx.startBGM();
        introScreen.classList.add('hidden');
        if (window.__introPortrait) { window.__introPortrait.stop(); window.__introPortrait = null; }
        this.perf.arm();
        this.progression.checkOffer();
        if (this.isTouch) {
          this.enterFullscreen();
          if (window.matchMedia('(orientation: portrait)').matches) {
            this.showToast('📱 Tipp: Halte das Handy quer, dann spielt es sich besser', 6000);
          }
        }
      };
      btnStart.addEventListener('click', startAdventure);

      // Co-op lobby: name + room code, then join the relay server this page came from
      const btnCoop = document.getElementById('btn-start-coop');
      const nameInput = document.getElementById('player-name');
      const roomInput = document.getElementById('room-code');
      const status = document.getElementById('coop-status');
      if (btnCoop && nameInput && roomInput && status) {
        try {
          nameInput.value = localStorage.getItem('gs-player-name') || '';
          roomInput.value = localStorage.getItem('gs-room') || 'GALAXY';
        } catch (e) { /* storage unavailable */ }
        const roomParam = new URLSearchParams(location.search).get('room');
        if (roomParam) roomInput.value = roomParam;

        btnCoop.addEventListener('click', async () => {
          const name = nameInput.value.trim() || 'Spieler';
          const room = roomInput.value.trim() || 'GALAXY';
          try {
            localStorage.setItem('gs-player-name', name);
            localStorage.setItem('gs-room', room);
          } catch (e) { /* ignore */ }
          btnCoop.disabled = true;
          status.textContent = '📡 Verbinde …';
          try {
            await this.coop.join({ name, room });
            startAdventure();
          } catch (err) {
            status.textContent = err.message === 'full'
              ? '🚫 Dieser Raum ist voll (max. 4 Spieler).'
              : '📡 Kein Koop-Server erreichbar. Starte start_multiplayer.bat und öffne die dort angezeigte Adresse.';
          } finally {
            btnCoop.disabled = false;
          }
        });
      }
    }

    const btnJump = document.getElementById('circle-jump');
    if (btnJump) {
      const handleJump = (e) => {
        e.preventDefault();
        this.haptic(10);
        this.doJump();
        btnJump.blur();
      };
      btnJump.addEventListener('touchstart', handleJump, { passive: false });
      btnJump.addEventListener('mousedown', handleJump);
    }

    const btnP1 = document.getElementById('circle-power1');
    if (btnP1) {
      const handleP1 = (e) => {
        e.preventDefault();
        this.haptic(14);
        this.castAbility1();
        btnP1.blur();
      };
      btnP1.addEventListener('touchstart', handleP1, { passive: false });
      btnP1.addEventListener('mousedown', handleP1);
    }

    const btnP2 = document.getElementById('circle-power2');
    if (btnP2) {
      const handleP2 = (e) => {
        e.preventDefault();
        this.haptic(14);
        this.castAbility2();
        btnP2.blur();
      };
      btnP2.addEventListener('touchstart', handleP2, { passive: false });
      btnP2.addEventListener('mousedown', handleP2);
    }

    const joystickBase = document.getElementById('joystick-base');
    const joystickThumb = document.getElementById('joystick-thumb');
    if (joystickBase && joystickThumb) {
      let isDragging = false;
      let touchId = null; // the finger that owns the stick (the other hand turns the camera)
      let startX = 0;
      let startY = 0;
      let maxRadius = 42;

      const startJoy = (clientX, clientY) => {
        isDragging = true;
        const rect = joystickBase.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        maxRadius = rect.width * 0.35;
        moveJoy(clientX, clientY);
      };

      const moveJoy = (clientX, clientY) => {
        if (!isDragging) return;
        let dx = clientX - startX;
        let dy = clientY - startY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }
        joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
        // Small dead zone so a resting thumb does not creep
        const mag = Math.hypot(dx, dy) / maxRadius;
        const dead = 0.14;
        const k = mag < dead ? 0 : (mag - dead) / (1 - dead) / mag;
        this.joystickDelta.x = (dx / maxRadius) * k;
        this.joystickDelta.y = (dy / maxRadius) * k;
      };

      const endJoy = () => {
        isDragging = false;
        touchId = null;
        joystickThumb.style.transform = 'translate(0px, 0px)';
        this.joystickDelta.x = 0;
        this.joystickDelta.y = 0;
      };

      const findTouch = (list) => {
        for (let i = 0; i < list.length; i++) if (list[i].identifier === touchId) return list[i];
        return null;
      };

      joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (touchId !== null || e.changedTouches.length === 0) return;
        const t = e.changedTouches[0];
        touchId = t.identifier;
        startJoy(t.clientX, t.clientY);
      }, { passive: false });

      window.addEventListener('touchmove', (e) => {
        if (!isDragging || touchId === null) return;
        const t = findTouch(e.touches);
        if (t) moveJoy(t.clientX, t.clientY);
      }, { passive: false });

      const touchEnd = (e) => {
        if (touchId !== null && findTouch(e.changedTouches)) endJoy();
      };
      window.addEventListener('touchend', touchEnd);
      window.addEventListener('touchcancel', touchEnd);

      joystickBase.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startJoy(e.clientX, e.clientY);
      });
      window.addEventListener('mousemove', (e) => {
        if (isDragging) moveJoy(e.clientX, e.clientY);
      });
      window.addEventListener('mouseup', endJoy);
    }
  },


  setupUI() {
    this.switchSister(0);
  },


  showFloatingText(text, worldPos, color = '#fff') {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.color = color;

    const screenPos = worldPos.clone().project(this.camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1200);
  },


  updateDaytimeButton() {
    const btn = document.getElementById('btn-daytime');
    if (!btn) return;
    const ph = this.dayNight.phase;
    if (ph === this.lastPhaseShown) return;
    this.lastPhaseShown = ph;
    btn.textContent = `${ph.icon} ${ph.name} ⏩`;
  }
};
