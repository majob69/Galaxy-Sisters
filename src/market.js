// ==========================================
// MARKET: three stalls near the village where Sterntaler (star coins) buy food, building
// materials and puzzle helpers. Each stall has a little shopkeeper; walk up and press F.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { ITEMS } from './inventory.js';
import { findFlatSpot } from './spots.js';
import { createCritter, animateCritter } from './critters.js';
import { blinkFace } from './characters.js';

export const STALLS = [
  { id: 'food', name: 'Leckereien', keeper: 'bunny', owner: 'Hoppla', awning: [0xff8fb1, 0xffffff], items: ['apple', 'berries', 'bread', 'soup', 'cake'] },
  { id: 'build', name: 'Baumaterial', keeper: 'bear', owner: 'Brummo', awning: [0x7fbf6a, 0xfff3d6], items: ['wood', 'stone', 'glass', 'rope', 'cloth'] },
  { id: 'magic', name: 'Zauberkram', keeper: 'owl', owner: 'Professor Uhu', awning: [0x8f7bff, 0xfff6c8], items: ['weight', 'candle', 'lantern'] }
];

const RANGE = 3.4;

function awningTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `#${(i % 2 ? b : a).toString(16).padStart(6, '0')}`;
    ctx.fillRect(i * 16, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Market {
  constructor(game, avoid = []) {
    this.game = game;
    this.center = findFlatSpot(game, { target: { x: -4, z: -24 }, radius: 9, avoid });
    this.group = new THREE.Group();
    this.stalls = [];
    this.build();
    game.scene.add(this.group);
    this.buildShopUI();
  }

  build() {
    const g = this.game;
    const { x: cx, z: cz } = this.center;
    // stalls in a gentle arc, facing the start of the valley
    const face = Math.atan2(0 - cx, 8 - cz);
    const wood = new THREE.MeshLambertMaterial({ color: 0xa8713f, flatShading: true });
    const woodDark = new THREE.MeshLambertMaterial({ color: 0x7a4f2a, flatShading: true });
    STALLS.forEach((def, i) => {
      const off = (i - 1) * 5.2;
      const x = cx + Math.cos(face) * off;
      const z = cz - Math.sin(face) * off;
      const y = g.getTerrainHeight(x, z);
      const stall = new THREE.Group();
      stall.position.set(x, y, z);
      stall.rotation.y = face;
      // counter
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 1.0), wood);
      counter.position.set(0, 0.5, 0.6);
      counter.castShadow = true;
      stall.add(counter);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.2), woodDark);
      top.position.set(0, 1.05, 0.6);
      stall.add(top);
      // posts and striped awning
      [-1.55, 1.55].forEach(px => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), woodDark);
        post.position.set(px, 1.4, 1.05);
        stall.add(post);
        const back = post.clone();
        back.position.z = -0.6;
        stall.add(back);
      });
      const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0), new THREE.MeshLambertMaterial({ map: awningTexture(def.awning[0], def.awning[1]), side: THREE.DoubleSide }));
      awning.position.set(0, 2.85, 0.25);
      awning.rotation.x = -Math.PI / 2 + 0.35;
      stall.add(awning);
      // goods on the counter
      def.items.forEach((id, k) => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(ITEMS[id].icon), transparent: true, depthWrite: false }));
        sprite.scale.setScalar(0.5);
        sprite.position.set(-1.2 + k * 0.6, 1.38, 0.65);
        stall.add(sprite);
      });
      // sign
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex(def.name), transparent: true, depthWrite: false }));
      sign.scale.set(2.6, 0.65, 1);
      sign.position.set(0, 3.55, 0.6);
      stall.add(sign);
      // shopkeeper behind the counter
      const keeper = createCritter(def.keeper, { scale: 1.05, accessory: def.id === 'magic' ? 'hat' : 'apron' });
      keeper.position.set(0, 0, -0.25);
      keeper.userData.baseY = 0;
      stall.add(keeper);
      this.group.add(stall);
      g.colliders.push({ type: 'cylinder', x, z, radius: 1.6, minY: y - 1, maxY: y + 3 });
      // the spot in front of the counter where the player talks to the keeper
      const front = new THREE.Vector3(x + Math.sin(face) * 1.9, y, z + Math.cos(face) * 1.9);
      this.stalls.push({ def, x, z, front, keeper, group: stall });
    });
  }

  // Interact-key provider
  getInteraction() {
    const pp = this.game.playerGroup.position;
    let best = null;
    let bd = RANGE;
    this.stalls.forEach(s => {
      const d = Math.hypot(pp.x - s.front.x, pp.z - s.front.z);
      if (d < bd) { bd = d; best = s; }
    });
    return best ? { dist: bd, label: `🛒 ${best.def.name} (${best.def.owner})`, action: () => this.openShop(best) } : null;
  }

  update(delta) {
    const t = this.game.clock.elapsedTime;
    const pp = this.game.playerGroup.position;
    this.stalls.forEach((s, i) => {
      s.keeper.visible = Math.hypot(pp.x - s.x, pp.z - s.z) < 60;
      if (!s.keeper.visible) return;
      animateCritter(s.keeper, t, i * 2);
      blinkFace(s.keeper.userData.face, t);
    });
    // close the shop when walking away
    if (this.openStall) {
      if (Math.hypot(pp.x - this.openStall.front.x, pp.z - this.openStall.front.z) > RANGE + 2) this.closeShop();
    }
  }

  // ---------- Shop window ----------
  buildShopUI() {
    const modal = document.createElement('div');
    modal.id = 'shop-modal';
    modal.className = 'album-modal shop-modal';
    const card = document.createElement('div');
    card.className = 'album-card';
    modal.appendChild(card);
    modal.addEventListener('click', (e) => { if (e.target === modal) this.closeShop(); });
    document.body.appendChild(modal);
    this.modal = modal;
    this.card = card;
  }

  openShop(stall) {
    this.openStall = stall;
    this.modal.classList.add('open');
    this.renderShop();
  }

  closeShop() {
    this.openStall = null;
    this.modal.classList.remove('open');
  }

  buy(id) {
    const g = this.game;
    const it = ITEMS[id];
    if (!g.inventory.spendCoins(it.price)) {
      g.showToast(`🪙 Dir fehlen ${it.price - g.inventory.coins} Sterntaler. Löse Aufgaben und Rätsel, um mehr zu bekommen!`, 3500);
      return;
    }
    g.inventory.add(id, 1, true);
    sfx.collect();
    g.showToast(`${it.icon} ${it.name} gekauft (−${it.price} 🪙)`, 2000);
    this.renderShop();
  }

  renderShop() {
    const s = this.openStall;
    if (!s) return;
    const g = this.game;
    const card = this.card;
    card.textContent = '';
    const head = document.createElement('div');
    head.className = 'album-head';
    const title = document.createElement('div');
    title.className = 'album-title';
    title.textContent = `🛒 ${s.def.name} bei ${s.def.owner} · Du hast 🪙 ${g.inventory.coins}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'album-close clickable';
    close.textContent = '✕';
    close.addEventListener('click', () => this.closeShop());
    head.append(title, close);
    card.appendChild(head);
    const list = document.createElement('div');
    list.className = 'shop-list';
    s.def.items.forEach(id => {
      const it = ITEMS[id];
      const row = document.createElement('div');
      row.className = 'shop-row';
      const icon = document.createElement('span');
      icon.className = 'shop-icon';
      icon.textContent = it.icon;
      const info = document.createElement('div');
      info.className = 'shop-info';
      const nm = document.createElement('b');
      nm.textContent = `${it.name}`;
      const desc = document.createElement('div');
      desc.className = 'shop-desc';
      desc.textContent = it.kind === 'food' ? `+${it.heal} HP · du hast ${g.inventory.count(id)}` : `${it.desc || 'Material zum Bauen'} · du hast ${g.inventory.count(id)}`;
      info.append(nm, desc);
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'shop-buy clickable';
      buy.textContent = `${it.price} 🪙`;
      buy.disabled = g.inventory.coins < it.price;
      buy.addEventListener('click', () => this.buy(id));
      row.append(icon, info, buy);
      list.appendChild(row);
    });
    card.appendChild(list);
  }
}

function emojiTex(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '46px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTex(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(122, 79, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(4, 6, 248, 52, 14);
  ctx.fill();
  ctx.fillStyle = '#fff6dc';
  ctx.font = '800 30px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
