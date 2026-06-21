// ── Storage helpers ──────────────────────────────────────────────
const POSTS_KEY = 'grg_posts';
const AUTH_KEY  = 'grg_auth';

function getPosts() {
  try { return JSON.parse(localStorage.getItem(POSTS_KEY)) || []; }
  catch { return []; }
}

function savePosts(posts) {
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

function isLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

// ── URL routing ──────────────────────────────────────────────────
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Date formatting ──────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Excerpt ──────────────────────────────────────────────────────
function excerpt(body, len = 180) {
  const plain = body.replace(/<[^>]*>/g, '').trim();
  return plain.length > len ? plain.slice(0, len).trimEnd() + '…' : plain;
}

// ── Simple text-to-HTML (preserves line breaks & basic markdown) ──
function renderBody(text) {
  // Escape HTML
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold **text** and *italic*
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Headings at start of line
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');

  // Block quotes
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Paragraphs: split on blank lines
  const blocks = s.split(/\n\s*\n/);
  return blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^<(h[23]|blockquote)/.test(b)) return b;
    return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
}

// ── INDEX PAGE ───────────────────────────────────────────────────
function initIndex() {
  const list = document.getElementById('post-list');
  if (!list) return;

  const posts = getPosts().sort((a, b) => b.date.localeCompare(a.date));

  if (!posts.length) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No writings yet. Check back soon.</p>
      </div>`;
    return;
  }

  list.innerHTML = posts.map(p => `
    <a class="post-card" href="post.html?id=${p.id}">
      ${p.cover ? `<div class="post-cover-wrap"><img class="post-cover" src="${p.cover}" alt=""></div>` : ''}
      <div class="post-card-body">
        <div class="post-meta">${formatDate(p.date)}</div>
        <h2 class="post-title">${p.title}</h2>
        <p class="post-excerpt">${excerpt(p.body)}</p>
        <span class="post-read-more">Read &rarr;</span>
      </div>
    </a>
  `).join('');
}

// ── POST PAGE ────────────────────────────────────────────────────
function initPost() {
  const wrap = document.getElementById('post-content');
  if (!wrap) return;

  const id = getParam('id');
  const posts = getPosts();
  const post = posts.find(p => p.id === id);

  if (!post) {
    wrap.innerHTML = `<div class="empty-state"><p>Post not found.</p></div>`;
    return;
  }

  document.title = post.title + ' — God Revealing God';

  wrap.innerHTML = `
    ${post.cover ? `<div class="post-cover-wrap"><img class="post-cover" src="${post.cover}" alt=""></div>` : ''}
    <div class="post-meta">${formatDate(post.date)}</div>
    <h1>${post.title}</h1>
    <hr class="post-divider">
    <div class="post-body">${renderBody(post.body)}</div>
  `;
}

// ── ADMIN: LOGIN ─────────────────────────────────────────────────
function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;

  // Already logged in → go to admin
  if (isLoggedIn()) { window.location.href = 'admin.html'; return; }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const pw = document.getElementById('password').value;
    // Password stored in one place — change it here:
    const ADMIN_PASSWORD = 'grgadmin2024';
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      window.location.href = 'admin.html';
    } else {
      document.getElementById('login-error').textContent = 'Incorrect password.';
    }
  });
}

// ── ADMIN: DASHBOARD ─────────────────────────────────────────────
function initAdmin() {
  const wrap = document.getElementById('admin-wrap');
  if (!wrap) return;

  if (!isLoggedIn()) { window.location.href = 'login.html'; return; }

  const form      = document.getElementById('post-form');
  const flash     = document.getElementById('flash');
  const coverInput = document.getElementById('cover-input');
  const coverPrev  = document.getElementById('cover-preview');
  let coverDataUrl = '';

  // Cover image preview
  coverInput.addEventListener('change', () => {
    const file = coverInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      coverDataUrl = e.target.result;
      coverPrev.src = coverDataUrl;
      coverPrev.classList.add('show');
    };
    reader.readAsDataURL(file);
  });

  // Publish
  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const date  = document.getElementById('date').value;
    const body  = document.getElementById('body').value.trim();

    if (!title || !body) {
      showFlash('Please fill in a title and body.', 'error');
      return;
    }

    const post = {
      id:    Date.now().toString(),
      title,
      date:  date || new Date().toISOString().slice(0, 10),
      body,
      cover: coverDataUrl || '',
    };

    const posts = getPosts();
    posts.unshift(post);
    savePosts(posts);

    form.reset();
    coverDataUrl = '';
    coverPrev.classList.remove('show');
    showFlash('Published!', 'success');
    renderAdminList();
  });

  renderAdminList();

  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    window.location.href = 'login.html';
  });

  function showFlash(msg, type) {
    flash.textContent = msg;
    flash.className = 'flash ' + type;
    setTimeout(() => { flash.className = 'flash'; }, 4000);
  }

  function renderAdminList() {
    const listEl = document.getElementById('admin-post-list');
    const posts  = getPosts().sort((a, b) => b.date.localeCompare(a.date));

    if (!posts.length) {
      listEl.innerHTML = '<p style="color:var(--muted);font-size:.9rem;">No posts yet.</p>';
      return;
    }

    listEl.innerHTML = posts.map(p => `
      <div class="admin-post-row">
        <span class="admin-post-title">${p.title}</span>
        <span class="admin-post-date">${formatDate(p.date)}</span>
        <button class="btn btn-danger" style="padding:.4rem .85rem;font-size:.7rem;"
                onclick="deletePost('${p.id}')">Delete</button>
      </div>
    `).join('');
  }
}

function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  const posts = getPosts().filter(p => p.id !== id);
  savePosts(posts);
  // re-render
  const listEl = document.getElementById('admin-post-list');
  const remaining = posts.sort((a, b) => b.date.localeCompare(a.date));
  if (!remaining.length) {
    listEl.innerHTML = '<p style="color:var(--muted);font-size:.9rem;">No posts yet.</p>';
    return;
  }
  listEl.innerHTML = remaining.map(p => `
    <div class="admin-post-row">
      <span class="admin-post-title">${p.title}</span>
      <span class="admin-post-date">${new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      <button class="btn btn-danger" style="padding:.4rem .85rem;font-size:.7rem;"
              onclick="deletePost('${p.id}')">Delete</button>
    </div>
  `).join('');
}

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initIndex();
  initPost();
  initLogin();
  initAdmin();
});
