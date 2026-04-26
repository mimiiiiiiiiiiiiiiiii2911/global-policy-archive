const cfg = window.SUPABASE_CONFIG || {};
const SUPABASE_URL = cfg.url;
const SUPABASE_KEY = cfg.anonKey;
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const btnToggleCompose = document.getElementById('btnToggleCompose');
const COMPOSE_TOGGLE_CLOSED = 'Đăng bài viết';
const BTN_PUBLISH_DEFAULT = 'Xuất bản tin';
const BTN_PUBLISH_PENDING = 'Đang đăng...';

window.googleTranslateElementInit = function googleTranslateElementInit() {
    if (typeof window.google === 'undefined' || !window.google.translate) {
        return;
    }
    const run = function runTranslateElement() {
        try {
            const TE = window.google.translate.TranslateElement;
            const options = {
                pageLanguage: 'en',
                multilanguagePage: true,
                autoDisplay: false,
                includedLanguages: 'en,vi,es,fr,de,ja,ko,pt,ar,ru,zh-CN,zh-TW',
            };
            if (TE.InlineLayout) {
                options.layout = TE.InlineLayout.SIMPLE;
            }
            new TE(options, 'google_translate_element');
        } catch (e) {
            console.debug('Google Translate element failed:', e);
        }
    };
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function onFrame() {
            window.setTimeout(run, 0);
        });
    } else {
        window.setTimeout(run, 0);
    }
};

function isValidUuid(value) {
    return typeof value === 'string' && UUID_RE.test(value);
}

function escapeHtml(str) {
    if (str == null) {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function setLoadingMessage(message, isError) {
    const loading = document.getElementById('loading');
    if (!loading) {
        return;
    }
    loading.textContent = message;
    loading.classList.toggle('loading--error', Boolean(isError));
    loading.style.display = '';
}

function formatSupabaseError(err, options) {
    if (!err) {
        return 'Unknown error';
    }
    const msg = (err.message || '').toLowerCase();
    const code = err.code;
    if (code === 'PGRST205' || code === '42P01' || msg.includes('schema cache')) {
        return "Database table missing. In Supabase SQL Editor, run supabase/migrations/001_create_posts.sql, then refresh.";
    }
    if (msg.includes('relation') && msg.includes('does not exist')) {
        return "Table 'posts' is missing. Run supabase/migrations/001_create_posts.sql in the SQL Editor, then refresh.";
    }
    if (
        options &&
        options.delete &&
        (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied for table'))
    ) {
        return "Delete blocked by database rules. In Supabase SQL Editor, run supabase/migrations/002_allow_anon_delete_posts.sql, then refresh.";
    }
    return err.message || String(err);
}

async function fetchPosts() {
    const { data, error } = await _supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) {
        setLoadingMessage(formatSupabaseError(error), true);
        return;
    }
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    displayPosts(data || []);
}

function displayPosts(posts) {
    const feed = document.getElementById('feed');
    if (!feed) {
        return;
    }
    feed.innerHTML = posts
        .map((p) => {
            const idAttr = p.id != null ? escapeHtml(String(p.id)) : '';
            const d = new Date(p.created_at);
            const dateStr = d.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            const body = escapeHtml(p.content);
            return `
                <article class="post" data-post-id="${idAttr}">
                    <div class="post-meta">
                        <div class="post-meta-row">
                            <span>${escapeHtml(p.category || 'General')} | Policy Record</span>
                            <span>${dateStr}</span>
                        </div>
                        <button type="button" class="btn-delete" data-action="delete" data-post-id="${idAttr}">Xóa</button>
                    </div>
                    <div class="post-content">${body}</div>
                </article>
            `;
        })
        .join('');
}

function setComposeOpen(open) {
    const panel = document.getElementById('composePanel');
    if (!panel) {
        return;
    }
    panel.hidden = !open;
    if (btnToggleCompose) {
        btnToggleCompose.setAttribute('aria-expanded', open ? 'true' : 'false');
        btnToggleCompose.style.display = open ? 'none' : 'block';
    }
    if (open) {
        const ta = document.getElementById('statusInput');
        if (ta) {
            window.requestAnimationFrame(function focusTa() {
                ta.focus();
            });
        }
        if (typeof panel.scrollIntoView === 'function') {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else if (toggle) {
        toggle.focus();
    }
}

function onToggleComposeClick() {
    const panel = document.getElementById('composePanel');
    if (!panel) {
        return;
    }
    setComposeOpen(panel.hidden);
}

async function postStatus() {
    const statusInput = document.getElementById('statusInput');
    const categoryInput = document.getElementById('categoryInput');
    const btn = document.getElementById('btnPost');
    if (!statusInput || !categoryInput || !btn) {
        return;
    }
    const content = statusInput.value;
    const category = categoryInput.value;
    if (!content.trim()) {
        return;
    }
    const original = btn.textContent;
    btn.textContent = BTN_PUBLISH_PENDING;
    btn.disabled = true;
    const { error } = await _supabase.from('posts').insert([{ content, category }]);
    btn.disabled = false;
    btn.textContent = original;
    if (error) {
        setLoadingMessage(formatSupabaseError(error), true);
        return;
    }
    statusInput.value = '';
    setComposeOpen(false);
    await fetchPosts();
}

async function deletePost(postId, triggerButton) {
    if (!isValidUuid(postId)) {
        return;
    }
    if (!window.confirm('Xóa bài này khỏi lưu trữ?')) {
        return;
    }
    if (triggerButton) {
        triggerButton.disabled = true;
    }
    const { error } = await _supabase.from('posts').delete().eq('id', postId);
    if (triggerButton) {
        triggerButton.disabled = false;
    }
    if (error) {
        setLoadingMessage(formatSupabaseError(error, { delete: true }), true);
        return;
    }
    await fetchPosts();
}

function onFeedClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) {
        return;
    }
    const btn = t.closest('[data-action="delete"]');
    if (!btn) {
        return;
    }
    const id = btn.getAttribute('data-post-id');
    if (id) {
        deletePost(id, btn instanceof HTMLButtonElement ? btn : null);
    }
}

function init() {
    const btnPost = document.getElementById('btnPost');
    const btnCloseCompose = document.getElementById('btnCloseCompose');
    const feed = document.getElementById('feed');
    if (btnPost) {
        btnPost.addEventListener('click', postStatus);
    }
    if (btnToggleCompose) {
        btnToggleCompose.addEventListener('click', onToggleComposeClick);
    }
    if (btnCloseCompose) {
        btnCloseCompose.addEventListener('click', function onCloseCompose() {
            setComposeOpen(false);
        });
    }
    if (feed) {
        feed.addEventListener('click', onFeedClick);
    }
    fetchPosts();
}

document.addEventListener('DOMContentLoaded', init);