const SUPABASE_URL = "https://furdwhmgplodjkemkxkm.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cmR3aG1ncGxvZGprZW1reGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjkyMDAsImV4cCI6MjA4MTU0NTIwMH0.Om___1irBNCjya4slfaWqJeUVoyVCvvMaDHKwYm3yg0"; 

const ENABLE_SNOW = true; 

const ROUTE_MAP = {
    'home': 'fme120e0f',        
    'notice': '5a105e8b',  
    'free': 'ad023482',    
    'list': 'b3a8e0e1',    
    'admin': '9f86d081',   
    'write': '11e389c9',   
    'search': '05972be4',  
    'detail': 'e29a1c3f'  
};

function getPageFromCode(code) {
    return Object.keys(ROUTE_MAP).find(key => ROUTE_MAP[key] === code) || 'home';
}

const particlesConfig = {
  "particles": {
    "number": {
      "value": 100,
      "density": {
        "enable": true,
        "value_area": 800
      }
    },
    "color": {
      "value": "#ffffff"
    },
    "shape": {
      "type": "circle",
      "stroke": {
        "width": 0,
        "color": "#000000"
      },
      "polygon": {
        "nb_sides": 5
      }
    },
    "opacity": {
      "value": 0.8,
      "random": true,
      "anim": {
        "enable": false,
        "speed": 1,
        "opacity_min": 0.1,
        "sync": false
      }
    },
    "size": {
      "value": 5,
      "random": true,
      "anim": {
        "enable": false,
        "speed": 40,
        "size_min": 0.1,
        "sync": false
      }
    },
    "line_linked": {
      "enable": false,
      "distance": 500,
      "color": "#ffffff",
      "opacity": 0.4,
      "width": 2
    },
    "move": {
      "enable": true,
      "speed": 3,
      "direction": "bottom",
      "random": false,
      "straight": false,
      "out_mode": "out",
      "bounce": false,
      "attract": {
        "enable": false,
        "rotateX": 600,
        "rotateY": 1200
      }
    }
  },
  "interactivity": {
    "detect_on": "canvas",
    "events": {
      "onhover": {
        "enable": false,
        "mode": "bubble"
      },
      "onclick": {
        "enable": false,
        "mode": "repulse"
      },
      "resize": true
    },
    "modes": {
      "grab": {
        "distance": 400,
        "line_linked": {
          "opacity": 0.5
        }
      },
      "bubble": {
        "distance": 400,
        "size": 4,
        "duration": 0.3,
        "opacity": 1,
        "speed": 3
      },
      "repulse": {
        "distance": 200,
        "duration": 0.4
      },
      "push": {
        "particles_nb": 4
      },
      "remove": {
        "particles_nb": 2
      }
    }
  },
  "retina_detect": true
};

let dbClient;
try {
    if(SUPABASE_URL && SUPABASE_ANON_KEY) {
        const { createClient } = window.supabase; 
        dbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        dbClient.auth.onAuthStateChange((event, session) => {
            if (session) {
                isAdmin = true;
                updateAdminUI();
                updateAdminStats();
            } else {
                isAdmin = false;
                updateAdminUI();
            }
        });
    }
} catch(e) {}

if (typeof DOMPurify !== 'undefined') {
    DOMPurify.addHook('beforeSanitizeElements', (currentNode) => {
        if (currentNode && currentNode.nodeType === 1 && currentNode.tagName) {
            if (currentNode.tagName === 'IFRAME') return currentNode;
            if (currentNode.tagName === 'DIV' && currentNode.classList.contains('video-container')) return currentNode;
        }
    });
}

const renderer = new marked.Renderer();

function confirmExternalLink(url) {
    showConfirm(`외부 사이트로 이동합니다.\n\n링크: ${url}\n\n정말 연결하시겠습니까?`, () => {
        window.open(url, '_blank');
    }, "외부 링크 연결 확인", "이동");
}

renderer.link = function(href, title, text) {
    let cleanHref = href || '';
    let cleanTitle = title || '';
    let cleanText = text || cleanHref;

    if (typeof href === 'object' && href !== null) {
        cleanHref = href.href;
        cleanTitle = href.title;
        cleanText = href.text;
    }

    cleanHref = String(cleanHref).trim();
    
    if (!/^https?:\/\//i.test(cleanHref)) {
        if (cleanHref.toLowerCase().startsWith('www.')) {
            cleanHref = 'https://' + cleanHref;
        } else if (cleanHref.toLowerCase().startsWith('youtube.com') || cleanHref.toLowerCase().startsWith('youtu.be')) {
             cleanHref = 'https://' + cleanHref;
        }
    }

    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = cleanHref.match(youtubeRegex);

    if (match && match[1]) {
        return `<div class="video-container"><iframe src="https://www.youtube.com/embed/${match[1]}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    }

    const titleAttr = cleanTitle ? ` title="${cleanTitle}"` : '';
    try {
        const urlObj = new URL(cleanHref);
        const h = urlObj.hostname;
        if (!h.includes('youtube.com') && !h.includes('youtu.be') && !h.includes('github') && !h.endsWith('.com') && !h.endsWith('.net') && !h.endsWith('.co.kr')) {
             const safeHref = cleanHref.replace(/'/g, "\\'");
             return `<a href="#" onclick="confirmExternalLink('${safeHref}'); return false;"${titleAttr} class="external-link">${cleanText}</a>`;
        }
    } catch(e) {}

    return `<a href="${cleanHref}" target="_blank"${titleAttr} class="external-link">${cleanText}</a>`;
};

marked.setOptions({
    breaks: true,
    gfm: true,
    renderer: renderer
});

function escapeHtml(text) { 
    if (!text) return text; 
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); 
}

function sanitizeContent(html) { 
    return DOMPurify.sanitize(html, { 
        ALLOWED_TAGS: [
            'b', 'i', 'u', 'em', 'strong', 'a', 
            'ul', 'li', 'ol', 'p', 'br', 'img', 'font',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'blockquote', 'code', 'pre', 'hr',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'div', 'span', 'strike', 'del', 's',
            'iframe' 
        ], 
        ALLOWED_ATTR: [
            'src', 'style', 'class', 'href', 'target', 'rel', 'align', 'color', 'size', 'face', 'title',
            'onclick', 'frameborder', 'allow', 'allowfullscreen', 'width', 'height'
        ] 
    }); 
}

function saveLocalPosts() { localStorage.setItem('aa_posts', JSON.stringify(posts)); }
function loadLocalPosts() { const data = localStorage.getItem('aa_posts'); if(data) posts = JSON.parse(data); }

function saveNickname(name) {
    if(name && name !== '하포카' && name !== '익명') {
        localStorage.setItem('aa_saved_nickname', name);
    }
}
function loadSavedNickname() {
    return localStorage.getItem('aa_saved_nickname') || '';
}

let posts = [];
let currentBoardType = 'error';
let isAdmin = false;
let lastPage = 'home';
let errorViewMode = 'grid';
let visibleCount = 9;
let currentPostId = null;
let isWriting = false;
let editingPostId = null; 
let pendingActionType = null; 
let pendingTarget = null;
let pendingTargetId = null;
let editingCommentId = null;
let currentCommentImages = []; 
let replyingToCommentId = null; 
let replyingToCommentAuthor = null;
let currentEditorMode = 'html'; 
let confirmCallback = null;
let isAlertOpen = false; 
let isSnowInitialized = false;

let clientIP = "1.2.3.4"; 
async function fetchClientIP() {}

fetch('https://raw.githubusercontent.com/Pretsg/Archeage_auto/main/version.txt')
    .then(r => r.text())
    .then(t => { 
        let v = t.trim().split(/\s+/)[0]; 
        if(v && !v.toLowerCase().startsWith('v')) v = 'v' + v;
        document.getElementById('version-text').innerText = "최신버전  " + (v || 'v0.1');
    })
    .catch(e => {});

function goDownload() { window.open('https://github.com/Pretsg/Archeage_auto/releases', '_blank'); }

async function addBan() {
    const input = document.getElementById('banInput');
    const ip = input.value.trim();
    if(!ip) return showAlert("IP를 입력하세요.");
    if(!dbClient) return;

    const { error } = await dbClient.from('banned_ips').insert([{ ip: ip, reason: "관리자 수동 차단" }]);
    if(error) showAlert("차단 실패: " + error.message);
    else {
        showAlert("해당 IP가 차단되었습니다.");
        input.value = '';
        fetchBanList();
    }
}

async function fetchBanList() {
    const list = document.getElementById('banList');
    if(!list || !dbClient) return;
    
    const { data } = await dbClient.from('banned_ips').select('*').order('created_at', { ascending: false });
    list.innerHTML = '';
    
    if(data && data.length > 0) {
        data.forEach(ban => {
            const li = document.createElement('li');
            li.className = "flex justify-between items-center bg-white p-2 rounded border border-slate-200";
            li.innerHTML = `
                <span>${ban.ip} <span class="text-xs text-slate-400">(${ban.reason})</span></span>
                <button onclick="removeBan('${ban.ip}')" class="text-red-500 hover:text-red-700 text-xs font-bold">해제</button>
            `;
            list.appendChild(li);
        });
    } else {
        list.innerHTML = '<li class="text-center text-slate-400 text-xs">차단된 IP가 없거나 권한이 없습니다.</li>';
    }
}

async function removeBan(ip) {
    if(!confirm(`IP ${ip}의 차단을 해제하시겠습니까?`)) return;
    const { error } = await dbClient.from('banned_ips').delete().eq('ip', ip);
    if(error) showAlert("해제 실패");
    else {
        fetchBanList();
    }
}

async function recordVisit() {
    if(!dbClient) return;
    const today = new Date().toISOString().split('T')[0];
    const lastVisit = localStorage.getItem('last_visit_date');
    
    if(lastVisit !== today) {
        localStorage.setItem('last_visit_date', today);
        try {
            const { data, error } = await dbClient.from('daily_stats').select('*').eq('date', today).single();
            if(error && error.code === 'PGRST116') {
                await dbClient.from('daily_stats').insert([{ date: today, visitors: 1 }]);
            } else if(data) {
                await dbClient.from('daily_stats').update({ visitors: data.visitors + 1 }).eq('date', today);
            }
        } catch(e) {}
    }
}

function showAlert(msg, title = "알림") {
    isAlertOpen = true; 
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = msg;
    document.getElementById('alertModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('alertOkBtn').focus(), 50);
}

function showContentModal(htmlContent, title = "내용 확인") {
    isAlertOpen = true;
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerHTML = htmlContent; 
    document.getElementById('alertModal').classList.remove('hidden');
}

function closeAlert() {
    isAlertOpen = false;
    document.getElementById('alertModal').classList.add('hidden');
    document.getElementById('alertMessage').innerText = "";
    
    if(!document.getElementById('passwordModal').classList.contains('hidden')) {
        document.getElementById('verificationPw').focus();
    }
}

function showConfirm(msg, callback, title = "확인", btnText = "삭제") {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = msg;
    document.getElementById('btn-confirm-yes').innerText = btnText;
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirm() {
    document.getElementById('confirmModal').classList.add('hidden');
    confirmCallback = null;
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const loader = document.getElementById('global-loader');
    if(loader) loader.classList.remove('hidden');

    const confirmBtn = document.getElementById('btn-confirm-yes');
    if(confirmBtn) {
        confirmBtn.onclick = () => {
            if (confirmCallback) confirmCallback();
            closeConfirm();
        };
    }
});

async function fetchPosts(type) {
    if (!dbClient) {
        loadLocalPosts();
        renderBoard();
        return;
    }
    
    document.getElementById('loading-spinner').classList.remove('hidden');
    document.getElementById('board-container').innerHTML = '';
    
    const { data, error } = await dbClient
        .from('posts')
        .select('*, comments(*)')
        .eq('type', type)
        .is('deleted_at', null) 
        .order('created_at', { ascending: false });

    if (error) { 
        loadLocalPosts();
        renderBoard();
    } else {
        posts = data.map(p => ({
            ...p,
            date: new Date(p.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            comments: (p.comments || []).filter(c => !c.deleted_at),
            reports: p.reports || 0,
            reported_by: Array.isArray(p.reported_by) ? p.reported_by : [] 
        }));
        
        posts.sort((a, b) => {
            const pinA = a.is_pinned ? 1 : 0;
            const pinB = b.is_pinned ? 1 : 0;
            return pinB - pinA;
        });

        saveLocalPosts();
        renderBoard();
    }
    
    if(isAdmin) {
        updateAdminStats();
    }
    document.getElementById('loading-spinner').classList.add('hidden');
}

async function updateAdminStats() {
    if(!dbClient) return;
    
    const { count } = await dbClient.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null);
    document.getElementById('stat-total-posts').innerText = count || 0;
    
    const { count: banCount } = await dbClient.from('banned_ips').select('*', { count: 'exact', head: true });
    document.getElementById('stat-banned-count').innerText = banCount || 0;

    fetchRecentPostsAdmin();
    fetchBanList();
}

async function fetchRecentPostsAdmin() {
    const list = document.getElementById('recent-posts-admin');
    if(!list) return;

    const { data } = await dbClient
        .from('posts')
        .select('*')
        .neq('type', 'notice') 
        .is('deleted_at', null) 
        .order('created_at', { ascending: false })
        .limit(7); 

    list.innerHTML = '';
    
    if(data && data.length > 0) {
        data.forEach(post => {
            const date = new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
            const typeBadge = post.type === 'free' ? '<span class="text-slate-400 text-xs mr-1">[자유]</span>' : '<span class="text-red-400 text-xs mr-1">[질문]</span>';
            
            const li = document.createElement('li');
            li.className = "flex justify-between items-center py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 px-2 rounded transition";
            li.onclick = () => { 
                readPost(post.id); 
            };
            li.innerHTML = `
                <div class="truncate mr-2 flex items-center">
                    ${typeBadge}
                    <span class="text-slate-700 font-bold text-sm truncate">${escapeHtml(post.title)}</span>
                </div>
                <div class="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">${date}</div>
            `;
            list.appendChild(li);
        });
    } else {
        list.innerHTML = '<li class="text-center text-slate-400 py-4 text-xs">최근 글이 없습니다.</li>';
    }
}

function switchAdminTab(tabName) {
    ['dashboard', 'deleted-posts', 'deleted-comments', 'reported'].forEach(t => {
        const btn = document.getElementById(`tab-admin-${t}`);
        const content = document.getElementById(`admin-view-${t}`);
        
        if (t === tabName) {
            btn.className = "px-4 py-2 font-bold text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 rounded-t-lg transition whitespace-nowrap";
            content.classList.remove('hidden');
        } else {
            btn.className = "px-4 py-2 font-bold text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition whitespace-nowrap";
            content.classList.add('hidden');
        }
    });

    if (tabName === 'dashboard') updateAdminStats();
    if (tabName === 'deleted-posts') fetchDeletedPosts();
    if (tabName === 'deleted-comments') fetchDeletedComments();
    if (tabName === 'reported') fetchReportedItems();
}

function toggleSelectAll(type, checked) {
    const className = type === 'post' ? 'del-chk-post' : 'del-chk-comment';
    const checkboxes = document.querySelectorAll(`.${className}`);
    checkboxes.forEach(cb => cb.checked = checked);
}

async function fetchDeletedPosts() {
    if(!dbClient) return;
    const list = document.getElementById('deleted-posts-list');
    const noData = document.getElementById('no-deleted-posts');
    list.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 불러오는 중...</div>';
    
    const chkAll = document.getElementById('chk-all-posts');
    if(chkAll) chkAll.checked = false;

    const { data, error } = await dbClient
        .from('posts')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

    list.innerHTML = '';
    
    if (!data || data.length === 0) {
        noData.classList.remove('hidden');
        return;
    }
    noData.classList.add('hidden');

    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const post of data) {
        const delDate = new Date(post.deleted_at);
        const elapsed = now - delDate;
        
        if (elapsed > thirtyDays) {
            await dbClient.from('posts').delete().eq('id', post.id);
            continue;
        }

        const remainDays = 30 - Math.floor(elapsed / (24 * 60 * 60 * 1000));
        
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition";
        div.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && e.target.type !== 'checkbox') readPost(post.id);
        };
        
        div.innerHTML = `
            <input type="checkbox" class="del-chk-post w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" value="${post.id}" onclick="event.stopPropagation()">
            <div class="flex-grow min-w-0">
                <div class="font-bold text-slate-700 line-clamp-1">${escapeHtml(post.title)}</div>
                <div class="text-xs text-red-400 mt-1">삭제일: ${delDate.toLocaleDateString()} (영구 삭제까지 ${remainDays}일)</div>
                <div class="text-xs text-slate-400">작성자: ${escapeHtml(post.author)}</div>
            </div>
            <div class="flex flex-col gap-2 shrink-0">
                <button onclick="event.stopPropagation(); restorePost('${post.id}')" class="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition whitespace-nowrap">복구</button>
                <button onclick="event.stopPropagation(); permanentlyDeletePost('${post.id}')" class="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">영구삭제</button>
            </div>
        `;
        list.appendChild(div);
    }
}

async function fetchReportedItems() {
    if(!dbClient) return;
    
    const postList = document.getElementById('reported-posts-list');
    const noPost = document.getElementById('no-reported-posts');
    postList.innerHTML = '<div class="text-center"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i></div>';
    
    const { data: rPosts } = await dbClient.from('posts').select('*').gte('reports', 5).is('deleted_at', null);
    
    postList.innerHTML = '';
    if(rPosts && rPosts.length > 0) {
        noPost.classList.add('hidden');
        rPosts.forEach(p => {
            const div = document.createElement('div');
            div.className = "bg-red-50 p-4 rounded-xl border border-red-200 flex flex-col gap-2 cursor-pointer hover:bg-red-100 transition";
            div.onclick = (e) => {
                if(e.target.tagName !== 'BUTTON') readPost(p.id);
            };
            
            div.innerHTML = `
                <div class="font-bold text-red-700">${escapeHtml(p.title)}</div>
                <div class="text-xs text-slate-500">작성자: ${escapeHtml(p.author)} | 신고: ${p.reports}회</div>
                <div class="text-xs text-slate-400">신고자 IP 목록: ${p.reported_by ? JSON.stringify(p.reported_by) : '없음'}</div>
                <div class="flex gap-2 mt-1">
                    <button onclick="event.stopPropagation(); clearReports('post', '${p.id}')" class="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold hover:bg-slate-100">신고 초기화 (복구)</button>
                    <button onclick="event.stopPropagation(); deletePost('${p.id}')" class="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700">삭제</button>
                </div>
            `;
            postList.appendChild(div);
        });
    } else {
        noPost.classList.remove('hidden');
    }

    const cmtList = document.getElementById('reported-comments-list');
    const noCmt = document.getElementById('no-reported-comments');
    cmtList.innerHTML = '<div class="text-center"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i></div>';
    
    const { data: rCmts } = await dbClient.from('comments').select('*').gte('reports', 5).is('deleted_at', null);
    
    cmtList.innerHTML = '';
    if(rCmts && rCmts.length > 0) {
        noCmt.classList.add('hidden');
        rCmts.forEach(c => {
            const cleanContent = c.content.replace(/<[^>]*>/g, ' ').substring(0, 30);
            const div = document.createElement('div');
            div.className = "bg-red-50 p-4 rounded-xl border border-red-200 flex flex-col gap-2 cursor-pointer hover:bg-red-100 transition";
            div.onclick = (e) => {
                if(e.target.tagName !== 'BUTTON') showContentModal(c.content, "신고된 댓글 전문");
            };

            div.innerHTML = `
                <div class="font-bold text-red-700 text-sm">${escapeHtml(cleanContent)}...</div>
                <div class="text-xs text-slate-500">작성자: ${escapeHtml(c.author)} | 신고: ${c.reports}회</div>
                <div class="text-xs text-slate-400">신고자 IP 목록: ${c.reported_by ? JSON.stringify(c.reported_by) : '없음'}</div>
                <div class="flex gap-2 mt-1">
                    <button onclick="event.stopPropagation(); clearReports('comment', '${c.id}')" class="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold hover:bg-slate-100">신고 초기화 (복구)</button>
                    <button onclick="event.stopPropagation(); deleteComment('${c.id}')" class="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700">삭제</button>
                </div>
            `;
            cmtList.appendChild(div);
        });
    } else {
        noCmt.classList.remove('hidden');
    }
}

async function clearReports(type, id) {
    if(!confirm("신고 횟수를 초기화하시겠습니까?")) return;
    const table = type === 'post' ? 'posts' : 'comments';
    const { error } = await dbClient.from(table).update({ reports: 0, reported_by: [] }).eq('id', id);
    
    if(error) showAlert("초기화 실패");
    else {
        showAlert("신고가 초기화되었습니다.");
        fetchReportedItems();
    }
}

async function restorePost(id) {
    if(!confirm("이 게시글을 복구하시겠습니까?")) return;
    const { error } = await dbClient.from('posts').update({ deleted_at: null, status: 'restored' }).eq('id', id);
    if(error) showAlert("복구 실패: " + error.message);
    else {
        showAlert("게시글이 복구되었습니다.");
        fetchDeletedPosts();
    }
}

async function permanentlyDeletePost(id) {
    showConfirm("이 게시글을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.", async () => {
        const { error } = await dbClient.from('posts').delete().eq('id', id);
        if(error) showAlert("삭제 실패: " + error.message);
        else {
            showAlert("영구 삭제되었습니다.");
            fetchDeletedPosts();
        }
    }, "영구 삭제 확인", "영구 삭제");
}

async function deleteSelected(type) {
    const className = type === 'post' ? 'del-chk-post' : 'del-chk-comment';
    const checkedBoxes = document.querySelectorAll(`.${className}:checked`);
    
    if(checkedBoxes.length === 0) return showAlert("선택된 항목이 없습니다.");
    
    const ids = Array.from(checkedBoxes).map(cb => cb.value);
    const count = ids.length;
    const targetName = type === 'post' ? '게시글' : '댓글';

    showConfirm(`선택한 ${count}개의 ${targetName}을(를) 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`, async () => {
        const tableName = type === 'post' ? 'posts' : 'comments';
        const { error } = await dbClient.from(tableName).delete().in('id', ids);
        
        if(error) showAlert("삭제 실패: " + error.message);
        else {
            showAlert(`${count}개의 항목이 영구 삭제되었습니다.`);
            if(type === 'post') fetchDeletedPosts();
            else fetchDeletedComments();
        }
    }, "일괄 영구 삭제", "일괄 삭제");
}


async function fetchDeletedComments() {
    if(!dbClient) return;
    const list = document.getElementById('deleted-comments-list');
    const noData = document.getElementById('no-deleted-comments');
    list.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 불러오는 중...</div>';

    const chkAll = document.getElementById('chk-all-comments');
    if(chkAll) chkAll.checked = false;
    
    const { data, error } = await dbClient
        .from('comments')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

    list.innerHTML = '';
    
    if (!data || data.length === 0) {
        noData.classList.remove('hidden');
        return;
    }
    noData.classList.add('hidden');

    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const cmt of data) {
        const delDate = new Date(cmt.deleted_at);
        const elapsed = now - delDate;
        
        if (elapsed > thirtyDays) {
            await dbClient.from('comments').delete().eq('id', cmt.id);
            continue;
        }

        const remainDays = 30 - Math.floor(elapsed / (24 * 60 * 60 * 1000));
        const cleanContent = cmt.content.replace(/<[^>]*>/g, ' ').substring(0, 50);

        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition";
        div.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && e.target.type !== 'checkbox') {
                showContentModal(cmt.content, "삭제된 댓글 내용");
            }
        };
        
        div.innerHTML = `
            <input type="checkbox" class="del-chk-comment w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" value="${cmt.id}" onclick="event.stopPropagation()">
            <div class="flex-grow min-w-0">
                <div class="font-bold text-slate-700 line-clamp-1">${escapeHtml(cleanContent)}...</div>
                <div class="text-xs text-red-400 mt-1">삭제일: ${delDate.toLocaleDateString()} (영구 삭제까지 ${remainDays}일)</div>
                <div class="text-xs text-slate-400">작성자: ${escapeHtml(cmt.author)}</div>
            </div>
            <div class="flex flex-col gap-2 shrink-0">
                <button onclick="event.stopPropagation(); restoreComment('${cmt.id}')" class="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition whitespace-nowrap">복구</button>
                <button onclick="event.stopPropagation(); permanentlyDeleteComment('${cmt.id}')" class="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">영구삭제</button>
            </div>
        `;
        list.appendChild(div);
    }
}

async function restoreComment(id) {
    if(!confirm("이 댓글을 복구하시겠습니까?")) return;
    const { error } = await dbClient.from('comments').update({ deleted_at: null }).eq('id', id);
    if(error) showAlert("복구 실패");
    else {
        showAlert("댓글이 복구되었습니다.");
        fetchDeletedComments();
    }
}

async function permanentlyDeleteComment(id) {
    showConfirm("이 댓글을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.", async () => {
        const { error } = await dbClient.from('comments').delete().eq('id', id);
        if(error) showAlert("삭제 실패: " + error.message);
        else {
            showAlert("영구 삭제되었습니다.");
            fetchDeletedComments();
        }
    }, "영구 삭제 확인", "영구 삭제");
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function savePostToDB(postData) {
    const isPinned = document.getElementById('checkPinned').checked;
    
    if(!isAdmin) saveNickname(postData.author);

    if (editingPostId) {
        if(!dbClient) return showAlert("오프라인 상태에서는 수정할 수 없습니다.");
        
        const { error } = await dbClient.rpc('update_post_secure', {
            p_id: editingPostId,
            p_title: postData.title,
            p_content: postData.content,
            p_image_url: postData.image,
            p_is_pinned: isAdmin ? isPinned : false
        });

    if (!isAdmin && typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY') {
        try {
            const token = await new Promise((resolve) => {
                grecaptcha.ready(() => {
                    grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_post' }).then(resolve);
                });
            });
            
            if (!token) return showAlert("캡차 인증에 실패했습니다.");
            
            
        } catch (e) {
            console.error("Captcha error:", e);
        }
    }

        if (error) {
            showAlert("수정 실패: " + error.message);
        } else {
            showAlert("수정되었습니다.");
            isWriting = false;

            const oldPost = posts.find(p => p.id == editingPostId) || {};
            const updatedPost = {
                ...oldPost,
                id: editingPostId,
                title: postData.title,
                content: postData.content,
                image_url: postData.image,
                image: postData.image,
                is_pinned: isAdmin ? isPinned : (oldPost.is_pinned || false)
            };

            const idx = posts.findIndex(p => p.id == editingPostId);
            if (idx !== -1) {
                posts[idx] = updatedPost;
            } else {
                posts.unshift(updatedPost);
            }
            
            saveLocalPosts();
            
            const targetId = editingPostId;
            resetEditor();

            setTimeout(() => {
                readPost(targetId, updatedPost); 
            }, 100);
        }
        return;
    }


    let finalPw = postData.password;
    if(!isAdmin && finalPw) finalPw = await sha256(finalPw);

    const { data, error } = await dbClient.rpc('create_post_secure', {
        p_title: postData.title,
        p_content: postData.content,
        p_author: postData.author,
        p_password: finalPw,
        p_type: postData.type,
        p_image_url: postData.image,
        p_is_pinned: isAdmin ? isPinned : false
    });

    if (error) {
        showAlert("작성 실패: " + error.message);
    } else {
        showAlert('등록되었습니다.');
        isWriting = false;
        resetEditor();
        await fetchPosts(currentBoardType);
        router(currentBoardType);
    }
}

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) {
        router(event.state.page, false);
    } else {
        router('home', false);
    }
});

function router(page, pushHistory = true) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    const footer = document.getElementById('main-footer');
    if(page === 'write') {
        if(footer) footer.classList.add('hidden');
    } else {
        if(footer) footer.classList.remove('hidden');
    }

    if(['notice','free','list'].includes(page)) {
        document.getElementById('view-board').classList.remove('hidden');
        currentBoardType = (page==='list'?'error':page);
        visibleCount = (currentBoardType==='error'?9:10);
        document.getElementById('boardSearchInput').value = '';
        fetchPosts(currentBoardType);
    } else {
        const target = document.getElementById(`view-${page}`);
        if(target) target.classList.remove('hidden');
        if(page === 'admin') switchAdminTab('dashboard');
    }

    if (pushHistory) {
        const obfuscatedHash = ROUTE_MAP[page] ? ROUTE_MAP[page] : page;
        history.pushState({ page: page }, null, `#${obfuscatedHash}`);
    }

    window.scrollTo(0, 0);
    
    if(page !== 'write' && page !== 'detail') {
        lastPage = page;
    }
    
    isWriting = (page === 'write');

    const snowContainer = document.getElementById('snow-container');
    if (snowContainer) {
        if (page === 'home' && ENABLE_SNOW) {
            snowContainer.style.display = 'block';
            snowContainer.style.zIndex = '1';
            snowContainer.style.pointerEvents = 'none';
            
            if (!isSnowInitialized && typeof particlesJS !== 'undefined') {
                particlesJS('snow-container', particlesConfig);
                isSnowInitialized = true;
            }
        } else {
            snowContainer.style.display = 'none';
        }
    }
}

function renderBoard() {
    const container = document.getElementById('board-container');
    const titles = { notice: {t:'📢 공지사항', d:'중요 업데이트 및 안내'}, free: {t:'💬 자유대화방', d:'자유로운 소통 공간'}, error: {t:'🛠️ 오류해결소', d:'오류 질문 및 해결법 공유'} };
    document.getElementById('board-title').innerText = titles[currentBoardType].t;
    document.getElementById('board-desc').innerText = titles[currentBoardType].d;
    document.getElementById('view-toggles').classList.toggle('hidden', currentBoardType !== 'error');
    document.getElementById('btn-write-board').classList.toggle('hidden', currentBoardType === 'notice' && !isAdmin);

    if (currentBoardType === 'error') {
        document.getElementById('btn-grid').classList.toggle('view-btn-active', errorViewMode === 'grid');
        document.getElementById('btn-list').classList.toggle('view-btn-active', errorViewMode === 'list');
    }

    container.innerHTML = '';
    const keyword = document.getElementById('boardSearchInput').value.toLowerCase();
    
    const filtered = posts.filter(p => p.type === currentBoardType && (p.title.toLowerCase().includes(keyword) || p.author.toLowerCase().includes(keyword)));
    const showList = filtered.slice(0, visibleCount);
    
    document.getElementById('btn-more').classList.toggle('hidden', filtered.length <= visibleCount);
    if(showList.length === 0) { container.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400">게시글이 없습니다.</div>`; return; }

    const btnGrid = document.getElementById('btn-grid');
    
    if(currentBoardType === 'error') {
        if(errorViewMode === 'grid') container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
        else container.className = "flex flex-col gap-3";
    } else if(currentBoardType === 'free') {
        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    } else {
        container.className = "flex flex-col gap-3";
    }

    showList.forEach(post => {
        const safeTitle = escapeHtml(post.title);
        let authorBadge = '';
        if(post.author === '하포카' || post.author === 'Admin') authorBadge = `<span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>`;

        let ipTag = '';
        if(post.author !== '하포카' && post.author !== 'Admin' && !isAdmin) {
            let rawIp = post.ip || 'Unknown';
            if(rawIp.includes('.')) {
                let parts = rawIp.split('.');
                if(parts.length === 4) ipTag = `<span class="ml-2 text-[10px] text-slate-400 font-mono">${parts[0]}.${parts[1]}.***.***</span>`;
            }
        }

        const cmtCount = post.comments ? post.comments.length : 0;
        const displayImg = post.image_url || post.image;
        const pinnedClass = post.is_pinned ? 'pinned-post' : '';
        const pinnedBadge = post.is_pinned ? '<div class="pinned-badge"><i class="fa-solid fa-thumbtack"></i></div>' : '';
        
        let cardStyle = "bg-white border-slate-200";
        if(post.reports >= 5) {
            cardStyle = "bg-red-50 border-red-300 ring-2 ring-red-200";
        }

        let html = '';
        if(container.className.includes('grid')) {
            let imgHtml = displayImg ? `<div class="h-40 bg-slate-100 overflow-hidden group relative"><img src="${displayImg}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105"></div>` : `<div class="h-40 bg-slate-50 flex items-center justify-center text-slate-300 text-3xl"><i class="fa-solid ${currentBoardType==='free'?'fa-comments':'fa-terminal'}"></i></div>`;
            html = `<div onclick="readPost('${post.id}')" class="${cardStyle} rounded-xl border shadow-sm hover:shadow-md transition flex flex-col h-full group overflow-hidden cursor-pointer ${pinnedClass}">${pinnedBadge}${currentBoardType!=='free' ? imgHtml : ''}<div class="p-5 flex-grow flex flex-col"><h3 class="font-bold text-slate-800 text-lg mb-2 line-clamp-2 group-hover:text-blue-600 transition">${safeTitle}</h3><div class="mt-auto pt-3 border-t border-slate-50 flex flex-col"><div class="flex justify-between text-xs text-slate-500"><span>${escapeHtml(post.author)}${authorBadge} ${ipTag}</span><span>${post.date}</span></div><div class="flex gap-3 text-xs text-slate-400 mt-2"><span class="flex items-center"><i class="fa-regular fa-eye mr-1"></i> ${post.views||0}</span><span class="flex items-center"><i class="fa-regular fa-comments mr-1"></i> ${cmtCount}</span></div></div></div></div>`;
        } else {
            html = `<div onclick="readPost('${post.id}')" class="flex items-center p-4 ${cardStyle} border rounded-xl shadow-sm hover:border-blue-400 transition cursor-pointer group ${pinnedClass}">${pinnedBadge}<div class="mr-4 w-10 text-center text-xl text-slate-400"><i class="fa-solid ${currentBoardType==='notice'?'fa-bullhorn text-blue-500':'fa-file-lines'}"></i></div><div class="flex-grow min-w-0"><div class="flex items-center gap-2 mb-1"><h3 class="font-bold text-slate-800 truncate group-hover:text-blue-600 transition">${safeTitle}</h3>${displayImg?'<i class="fa-regular fa-image text-slate-400 text-xs"></i>':''}</div><div class="flex items-center gap-4"><div class="text-xs text-slate-500 flex gap-2"><span>${escapeHtml(post.author)}${authorBadge} ${ipTag}</span><span>${post.date}</span></div><div class="flex gap-3 text-xs text-slate-400"><span class="flex items-center"><i class="fa-regular fa-eye mr-1"></i> ${post.views||0}</span><span class="flex items-center"><i class="fa-regular fa-comments mr-1"></i> ${cmtCount}</span></div></div></div></div>`;
        }
        container.innerHTML += html;
    });
}

function toggleSearchDropdown(viewType) {
    const menu = document.getElementById(`menu-search-type-${viewType}`);
    const isHidden = menu.classList.contains('hidden');
    
    document.querySelectorAll('[id^="menu-search-type-"]').forEach(el => el.classList.add('hidden'));
    
    if (isHidden) {
        menu.classList.remove('hidden');
    }
}

function selectSearchType(value, label) {
    document.getElementById('searchTypeSelect').value = value;
    document.getElementById('mobileSearchTypeSelect').value = value;
    
    document.getElementById('txt-search-type-desktop').innerText = label;
    document.getElementById('txt-search-type-mobile').innerText = label;
    
    document.querySelectorAll('[id^="menu-search-type-"]').forEach(el => el.classList.add('hidden'));
}

function toggleFontSizeDropdown() {
    const menu = document.getElementById('menu-font-size');
    menu.classList.toggle('hidden');
}

function applyFontSize(size, label) {
    execCmd('fontSize', size);
    document.getElementById('txt-font-size').innerText = label;
    document.getElementById('menu-font-size').classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-search-type-desktop') && !e.target.closest('#btn-search-type-mobile')) {
         document.querySelectorAll('[id^="menu-search-type-"]').forEach(el => el.classList.add('hidden'));
    }
    
    if (!e.target.closest('#btn-font-size')) {
        const menu = document.getElementById('menu-font-size');
        if(menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
        }
    }
});

async function searchGlobal(keyword) {
    if(!keyword) {
        keyword = document.getElementById('globalSearchInput').value.trim() || document.getElementById('mobileSearchInput').value.trim();
    }
    
    let searchType = 'all';
    const mobileBtn = document.getElementById('btn-search-type-mobile');
    
    if(window.getComputedStyle(mobileBtn).display !== 'none' && mobileBtn.offsetParent !== null) {
        searchType = document.getElementById('mobileSearchTypeSelect').value;
    } else {
        searchType = document.getElementById('searchTypeSelect').value;
    }

    if(keyword.length < 2) return showAlert("검색어는 2글자 이상 입력해주세요.");
    
    document.getElementById('globalSearchInput').value = keyword;
    document.getElementById('mobileSearchInput').value = keyword;
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-search').classList.remove('hidden');
    window.scrollTo(0,0);
    
    if(lastPage !== 'search') history.pushState({ page: 'search' }, null, `#${ROUTE_MAP['search'] || 'search'}`);
    lastPage = 'search'; 

    document.querySelector('#search-keyword-display span').innerText = keyword;
    const container = document.getElementById('search-results-container');
    container.innerHTML = '';
    document.getElementById('loading-spinner').classList.remove('hidden');

    let queryResults = [];

    if(dbClient) {
        let query = dbClient.from('posts').select('*').order('created_at', {ascending: false});
        if (searchType === 'nickname') {
            query = query.ilike('author', `%${keyword}%`);
        } else {
            query = query.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`);
        }
        const { data, error } = await query;
        if(!error && data) queryResults = data;
    } else {
        if (searchType === 'nickname') {
            queryResults = posts.filter(p => p.author.toLowerCase().includes(keyword.toLowerCase()));
        } else {
            queryResults = posts.filter(p => p.title.toLowerCase().includes(keyword.toLowerCase()) || p.content.toLowerCase().includes(keyword.toLowerCase()));
        }
    }
    
    renderSearchResults(queryResults, keyword);
    document.getElementById('loading-spinner').classList.add('hidden');
}

function renderSearchResults(results, keyword) {
    const container = document.getElementById('search-results-container');
    const noResult = document.getElementById('search-no-result');
    
    if(results.length === 0) {
        noResult.classList.remove('hidden');
        return;
    }
    noResult.classList.add('hidden');

    const typeMap = {'free':'자유', 'error':'오류', 'notice':'공지'};
    const typeColor = {'free':'bg-slate-100 text-slate-600', 'error':'bg-red-100 text-red-600', 'notice':'bg-blue-100 text-blue-600'};

    results.forEach(post => {
        let highlightedTitle = escapeHtml(post.title);
        const searchType = document.getElementById('searchTypeSelect').value === 'nickname' ? 'nickname' : 'all';
        
        if (searchType !== 'nickname') {
            const regex = new RegExp(`(${keyword})`, 'gi');
            highlightedTitle = escapeHtml(post.title).replace(regex, '<span class="search-highlight">$1</span>');
        }
        
        const div = document.createElement('div');
        div.innerHTML = marked.parse(post.content); 
        let textContent = div.textContent || div.innerText || "";
        
        let snippet = textContent.substring(0, 100) + "...";
        
        if (searchType !== 'nickname') {
            const idx = textContent.toLowerCase().indexOf(keyword.toLowerCase());
            if(idx > -1) {
                const start = Math.max(0, idx - 20);
                const end = Math.min(textContent.length, idx + 40);
                snippet = (start>0?"...":"") + textContent.substring(start, end) + (end<textContent.length?"...":"");
            }
        }
        
        const badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded font-bold ${typeColor[post.type] || 'bg-gray-100'}">${typeMap[post.type] || '기타'}</span>`;

        container.innerHTML += `<div onclick="readPost('${post.id}')" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition cursor-pointer"><div class="flex items-center gap-2 mb-2">${badgeHtml}<span class="text-xs text-slate-400">${new Date(post.created_at).toLocaleDateString()}</span></div><h3 class="font-bold text-lg text-slate-800 mb-2 truncate">${highlightedTitle}</h3><p class="text-sm text-slate-500 mb-3 break-all">${escapeHtml(snippet)}</p><div class="flex items-center gap-2 text-xs text-slate-400"><span>${escapeHtml(post.author)}</span><span class="mx-1">|</span><i class="fa-regular fa-eye mr-1"></i> ${post.views||0}</div></div>`;
    });
}

async function readPost(id, directData = null) {
    localStorage.setItem('aa_current_post_id', id);

    const viewedKey = `viewed_post_${id}`;
    if(dbClient && !sessionStorage.getItem(viewedKey)) {
        try {
            const { error } = await dbClient.rpc('increment_views', { row_id: id });
            
            if(!error) {
                const targetPost = posts.find(p => p.id == id);
                if (targetPost) {
                    targetPost.views = (targetPost.views || 0) + 1; 
                    dbClient.from('posts').update({ views: targetPost.views }).eq('id', id).then(() => {});
                }
                sessionStorage.setItem(viewedKey, 'true');
            }
        } catch (e) {}
    }
    
    let post = directData; 

    if (!post) {
        post = posts.find(p => p.id == id);
    }

    if (!post && dbClient) {
        try {
            const { data, error } = await dbClient
                .from('posts')
                .select('*, comments(*)')
                .eq('id', id)
                .single();
            
            if (error) {
                return showAlert("게시글 정보를 불러올 수 없습니다.");
            }

            if(data) {
                post = {
                    ...data,
                    date: new Date(data.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    comments: (data.comments || []).filter(c => !c.deleted_at),
                    reported_by: Array.isArray(data.reported_by) ? data.reported_by : []
                };
            }
        } catch (fetchError) {
            return showAlert("네트워크 오류로 게시글을 열 수 없습니다.");
        }
    }

    if (!post) {
        return router('list');
    }
    
    currentPostId = id;

    const titleEl = document.getElementById('detail-title');
    if(titleEl) titleEl.innerText = post.title || '제목 없음';
    
    let authorHtml = escapeHtml(post.author);
    if(post.author === '하포카' || post.author === 'Admin') {
        authorHtml += ` <span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>`;
    }
    const authorEl = document.getElementById('detail-author');
    if(authorEl) authorEl.innerHTML = authorHtml;

    const dateEl = document.getElementById('detail-date');
    if(dateEl) dateEl.innerText = post.date;
    
    const viewsEl = document.getElementById('detail-views');
    if(viewsEl) viewsEl.innerText = post.views || 0;
    
    const contentDiv = document.getElementById('detail-content');
    if(contentDiv) {
        const safeContent = post.content || ''; 
        
        let parsed = marked.parse(safeContent);
        
        contentDiv.innerHTML = sanitizeContent(parsed);
        
        contentDiv.querySelectorAll('img').forEach(img => {
            if (!img.classList.contains('youtube-thumbnail')) {
                img.onclick = () => openLightbox(img.src);
                img.classList.add('cursor-zoom-in');
            } else {
                img.style.cursor = 'pointer'; 
            }
        });
    }

    const badge = document.getElementById('detail-badge');
    if(badge) {
        let catName = "기타";
        let catClass = "bg-gray-100 text-gray-600";
        
        if (post.type === 'notice') { catName = "공지"; catClass = "bg-blue-100 text-blue-600"; }
        else if (post.type === 'free') { catName = "자유"; catClass = "bg-slate-100 text-slate-600"; }
        else if (post.type === 'error') { catName = "오류질문"; catClass = "bg-red-100 text-red-600"; }
        
        badge.innerText = catName;
        badge.className = `text-xs px-2 py-1 rounded font-bold ${catClass}`;
    }

    const btnDelete = document.getElementById('btn-force-delete');
    const btnEdit = document.getElementById('btn-edit-post');
    if(btnDelete) btnDelete.classList.remove('hidden');
    if(btnEdit) btnEdit.classList.remove('hidden');
    
    const adminControls = document.getElementById('admin-controls');
    if(adminControls) {
        if(isAdmin) {
            adminControls.classList.remove('hidden');
            const pinBtn = document.getElementById('btn-pin-post');
            if(pinBtn) {
                pinBtn.innerHTML = post.is_pinned ? '<i class="fa-solid fa-thumbtack"></i> 고정 해제' : '<i class="fa-solid fa-thumbtack"></i> 상단 고정';
                pinBtn.classList.toggle('text-blue-600', post.is_pinned);
            }
            
            const catSelect = document.getElementById('move-category-select');
            if(catSelect) {
                catSelect.innerHTML = '<option value="">카테고리 이동</option>';
                const categories = { 'notice': '공지사항', 'free': '자유대화방', 'error': '오류해결소' };
                for(const [key, label] of Object.entries(categories)) {
                    if(key !== post.type) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.innerText = label;
                        catSelect.appendChild(opt);
                    }
                }
            }
        } else {
            adminControls.classList.add('hidden');
        }
    }

    if(btnDelete) btnDelete.onclick = () => requestPasswordCheck(id, 'delete_post');
    if(btnEdit) btnEdit.onclick = () => requestPasswordCheck(id, 'edit_post');

    const commentWriteArea = document.getElementById('comment-write-area');
    if(commentWriteArea) {
        if(post.type === 'notice') commentWriteArea.classList.add('hidden');
        else commentWriteArea.classList.remove('hidden');
    }

    if(!isAdmin) {
        const cmtNameEl = document.getElementById('cmtName');
        if(cmtNameEl) cmtNameEl.value = loadSavedNickname();
    }

    cancelReply();
    renderComments(post.comments || []);
    router('detail');
}

async function reportCurrentPost() {
    if(!dbClient || !currentPostId) return showAlert("오프라인 상태에서는 신고할 수 없습니다.");

    showConfirm("정말 이 게시글을 신고하시겠습니까?", async () => {
        const { error } = await dbClient.rpc('report_content_secure', {
            p_type: 'post',
            p_id: currentPostId
        });

        if(error) {
            showAlert(error.message);
        } else {
            showAlert("신고가 접수되었습니다.");
            readPost(currentPostId); 
        }
    }, "신고 확인", "신고하기");
}

async function reportComment(id) {
    if(!dbClient) return showAlert("오프라인 상태에서는 신고할 수 없습니다.");

    showConfirm("정말 이 댓글을 신고하시겠습니까?", async () => {
        const { error } = await dbClient.rpc('report_content_secure', {
            p_type: 'comment',
            p_id: id
        });

        if(error) {
            showAlert(error.message);
        } else {
            showAlert("신고가 접수되었습니다.");
            readPost(currentPostId); 
        }
    }, "신고 확인", "신고하기");
}

async function togglePinPost() {
    if(!isAdmin || !currentPostId) return;
    
    const { data: post } = await dbClient.from('posts').select('is_pinned').eq('id', currentPostId).single();
    if(!post) return;

    const newStatus = !post.is_pinned;
    const { error } = await dbClient.from('posts').update({ is_pinned: newStatus }).eq('id', currentPostId);
    
    if(error) showAlert("고정 설정 실패");
    else {
        document.getElementById('btn-pin-post').innerHTML = newStatus ? '<i class="fa-solid fa-thumbtack"></i> 고정 해제' : '<i class="fa-solid fa-thumbtack"></i> 상단 고정';
        document.getElementById('btn-pin-post').classList.toggle('text-blue-600', newStatus);
        
        fetchPosts(currentBoardType);
    }
}

function movePostCategory(newType) {
    if(!newType || !currentPostId) return;
    
    const catName = { 'notice': '공지사항', 'free': '자유대화방', 'error': '오류해결소' }[newType];
    
    showConfirm(`이 게시글을 [${catName}]으로 이동하시겠습니까?`, async () => {
        const { error } = await dbClient.from('posts').update({ type: newType }).eq('id', currentPostId);
        if(error) {
            showAlert("이동 실패: " + error.message);
        } else {
            showAlert("게시글이 이동되었습니다.");
            router('list'); 
        }
    }, "카테고리 이동", "이동");
    
    document.getElementById('move-category-select').value = "";
}

function replyToComment(id, author) {
    replyingToCommentId = id;
    replyingToCommentAuthor = author;
    
    const targetMsg = document.getElementById('reply-target-msg');
    targetMsg.innerText = author;
    
    document.getElementById('reply-target-box').classList.remove('hidden');
    document.getElementById('cmtContent').focus();
    
    document.getElementById('cmt-drop-zone').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelReply() {
    replyingToCommentId = null;
    replyingToCommentAuthor = null;
    document.getElementById('reply-target-box').classList.add('hidden');
}

function buildCommentTree(comments) {
    const map = {};
    const roots = [];
    
    comments.forEach((c, index) => {
        const match = c.content.match(/<!-- parent_id:(.*?) -->/);
        const parentId = match ? match[1] : null;
        
        map[c.id] = { ...c, children: [], _originalIndex: index }; 
        map[c.id].displayContent = c.content.replace(/<!-- parent_id:.*? -->/g, '');
        
        if (parentId) {
            map[c.id].parentId = parentId;
        }
    });

    comments.forEach(c => {
        const node = map[c.id];
        if (node.parentId && map[node.parentId]) {
            map[node.parentId].children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortNodes = (nodes) => {
        nodes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        nodes.forEach(node => {
            if (node.children.length > 0) sortNodes(node.children);
        });
    };
    sortNodes(roots);
    
    return roots;
}

function renderCommentNode(node, depth, listElement) {
    const safeDepth = Math.min(depth, 3);
    
    let authorBadge = '';
    if(node.author === '하포카' || node.author === 'Admin') authorBadge = `<span class="admin-badge-icon"><i class="fa-solid fa-circle-check"></i></span>`;

    let wrapperClass = safeDepth > 0 ? `reply-item reply-depth-${safeDepth}` : "bg-white p-4 rounded-xl border border-slate-100";
    let indicator = safeDepth > 0 ? `<i class="fa-solid fa-turn-up fa-rotate-90 reply-indicator"></i>` : "";

    if (node.reports >= 5) {
        if (safeDepth > 0) {
            wrapperClass = wrapperClass.replace(/bg-slate-\d+/g, 'bg-red-50');
            wrapperClass += " border-red-200 ring-1 ring-red-100";
        } else {
            wrapperClass = "bg-red-50 p-4 rounded-xl border border-red-200 ring-1 ring-red-100";
        }
    }

    let ipTag = '';
    if(node.author !== '하포카' && node.author !== 'Admin') {
        let rawIp = node.ip || '1.2.3.4';
        if(rawIp.includes('.')) {
            let parts = rawIp.split('.');
            if(parts.length === 4) {
                if(isAdmin) ipTag = `<span class="text-red-300 text-[10px] ml-1">(${rawIp})</span>`;
                else ipTag = `<span class="text-slate-300 text-[10px] ml-1">(${parts[0]}.${parts[1]}.***.***)</span>`;
            }
        }
    }

    const html = `
        <div class="flex gap-3 group mb-3 ${wrapperClass}">
            ${indicator}
            <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0 select-none">${node.author.charAt(0)}</div>
            <div class="flex-grow min-w-0">
                <div class="flex items-baseline gap-2 justify-between">
                    <div class="flex items-baseline gap-2">
                        <span class="font-bold text-slate-700 text-sm">${escapeHtml(node.author)}${authorBadge}</span>
                        ${ipTag}
                        <span class="text-xs text-slate-400">${new Date(node.created_at).toLocaleString()}</span>
                    </div>
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onclick="replyToComment('${node.id}', '${node.author}')" class="text-slate-400 hover:text-blue-600 text-xs font-bold mr-2"><i class="fa-solid fa-reply"></i> 답글</button>
                        <button onclick="reportComment('${node.id}')" class="text-slate-400 hover:text-red-500 text-xs font-bold mr-2"><i class="fa-solid fa-land-mine-on"></i> 신고</button>
                        <button onclick="requestPasswordCheck('${node.id}', 'edit_comment')" class="text-slate-400 hover:text-blue-600 text-xs"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="requestPasswordCheck('${node.id}', 'delete_comment')" class="text-slate-400 hover:text-red-600 text-xs"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="text-slate-600 text-sm mt-1 whitespace-pre-wrap break-all">${node.displayContent}</div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = html;
    listElement.appendChild(div);

    if (node.children && node.children.length > 0) {
        node.children.forEach(child => renderCommentNode(child, depth + 1, listElement));
    }
}

function renderComments(cmts) {
    const list = document.getElementById('comment-list');
    list.innerHTML = '';
    document.getElementById('detail-comments-count').innerText = cmts.length;
    
    if (cmts.length === 0) { 
        list.innerHTML = '<p class="text-slate-400 text-center py-4">아직 댓글이 없습니다.</p>'; 
        return; 
    }

    const rootNodes = buildCommentTree(cmts);
    rootNodes.forEach(node => renderCommentNode(node, 0, list));
    
    document.querySelectorAll('#comment-list img').forEach(img => {
        img.onclick = () => openLightbox(img.src);
    });
}

function switchEditorTab(tab) {
    currentEditorMode = tab;
    const htmlBtn = document.getElementById('tab-html');
    const mdBtn = document.getElementById('tab-markdown');
    
    const htmlToolbar = document.getElementById('html-toolbar');
    const mdToolbar = document.getElementById('markdown-toolbar');
    
    const htmlArea = document.getElementById('editorContentHtml');
    const mdContainer = document.getElementById('markdown-container');
    const mdArea = document.getElementById('editorContentMarkdown');

    if (tab === 'html') {
        htmlBtn.className = "flex-1 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 bg-white";
        mdBtn.className = "flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700";
        
        htmlToolbar.classList.remove('hidden');
        mdToolbar.classList.add('hidden');
        
        htmlArea.classList.remove('hidden');
        mdContainer.classList.add('hidden');
        
        if (mdArea.value.trim().length > 0 && htmlArea.innerHTML.trim().length === 0) {
             htmlArea.innerHTML = marked.parse(mdArea.value);
        }
        
    } else {
        htmlBtn.className = "flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700";
        mdBtn.className = "flex-1 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 bg-white";
        
        htmlToolbar.classList.add('hidden');
        mdToolbar.classList.remove('hidden');
        
        htmlArea.classList.add('hidden');
        mdContainer.classList.remove('hidden');
        
        updateMarkdownPreview();
    }
}

document.getElementById('editorContentMarkdown').addEventListener('input', updateMarkdownPreview);

function updateMarkdownPreview() {
    const raw = document.getElementById('editorContentMarkdown').value;
    const preview = document.getElementById('markdown-preview');
    preview.innerHTML = sanitizeContent(marked.parse(raw));
}

function execCmd(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('editorContentHtml').focus();
    updateToolbar(); 
}

function updateToolbar() {
    const commands = [
        { cmd: 'bold', id: 'btn-bold' },
        { cmd: 'italic', id: 'btn-italic' },
        { cmd: 'underline', id: 'btn-underline' },
        { cmd: 'strikeThrough', id: 'btn-strikethrough' },
        { cmd: 'justifyLeft', id: 'btn-justifyLeft' },
        { cmd: 'justifyCenter', id: 'btn-justifyCenter' },
        { cmd: 'justifyRight', id: 'btn-justifyRight' }
    ];

    commands.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            if (document.queryCommandState(item.cmd)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

document.addEventListener('selectionchange', () => {
    if (document.activeElement === document.getElementById('editorContentHtml')) {
        updateToolbar();
    }
});

function insertMarkdown(symbol) {
    const textarea = document.getElementById('editorContentMarkdown');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selection = text.substring(start, end);

    let newText = "";
    if (symbol === '`' && selection.includes('\n')) {
        newText = before + "```\n" + selection + "\n```" + after;
    } else {
        newText = before + symbol + selection + symbol + after;
    }
    
    textarea.value = newText;
    textarea.focus();
    updateMarkdownPreview();
}

async function uploadCommentImage(input) {
    if(input.files && input.files.length > 0) {
        document.getElementById('global-loader').classList.remove('hidden');
        try {
            for (let i = 0; i < input.files.length; i++) {
                const file = input.files[i];
                
                if (!file.type.match('image.*')) {
                    showAlert("이미지 파일(JPG, PNG, GIF 등)만 업로드 가능합니다.");
                    continue; 
                }

                if(dbClient) {
                    try {
                        const fileName = `cmt_img_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
                        const { data, error } = await dbClient.storage.from('images').upload(fileName, file);
                        if(!error) {
                            const { data: { publicUrl } } = dbClient.storage.from('images').getPublicUrl(fileName);
                            currentCommentImages.push(publicUrl);
                        } else { throw error; }
                    } catch(err) { 
                        const reader = new FileReader();
                        await new Promise((resolve) => {
                            reader.onload = function(e) {
                                currentCommentImages.push(e.target.result);
                                resolve();
                            };
                            reader.readAsDataURL(file);
                        });
                    }
                } else {
                    await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            currentCommentImages.push(e.target.result);
                            resolve();
                        };
                        reader.readAsDataURL(file);
                    });
                }
            }
        } finally {
            renderCommentImagePreview();
            document.getElementById('global-loader').classList.add('hidden');
            input.value = '';
        }
    }
}

function renderCommentImagePreview() {
    const container = document.getElementById('cmtImagePreview');
    if(currentCommentImages.length > 0) {
        container.classList.remove('hidden');
        container.innerHTML = '';
        currentCommentImages.forEach((src, idx) => {
            container.innerHTML += `<div class="cmt-preview-item"><img src="${src}"><div class="cmt-preview-remove" onclick="removeCommentImage(${idx})"><i class="fa-solid fa-xmark"></i></div></div>`;
        });
    } else {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
}

function removeCommentImage(idx) {
    currentCommentImages.splice(idx, 1);
    renderCommentImagePreview();
}

async function submitComment() {
    let name = document.getElementById('cmtName').value.trim();
    let contentText = document.getElementById('cmtContent').value; 
    let pw = document.getElementById('cmtPw').value.trim();

    if(!contentText.trim() && currentCommentImages.length === 0) return showAlert("내용을 입력하세요.");

    if (!isAdmin && typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY') {
        try {
            const token = await new Promise((resolve) => {
                grecaptcha.ready(() => {
                    grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_comment' }).then(resolve);
                });
            });
            if (!token) return showAlert("캡차 인증에 실패했습니다.");
        } catch (e) {
            console.error("Captcha error:", e);
        }
    }

    if (isBanned) return showAlert("차단된 사용자는 댓글을 쓸 수 없습니다.");

    let imageHtml = '';
    if(currentCommentImages.length > 0) {
        imageHtml = '<div class="comment-img-container">';
        currentCommentImages.forEach(src => {
            imageHtml += `<img src="${src}" class="comment-img-thumb" onclick="openLightbox(this.src)">`;
        });
        imageHtml += '</div>';
    }
    
    let parentTag = '';
    if (replyingToCommentId) {
        parentTag = `<!-- parent_id:${replyingToCommentId} -->`;
    }

    let finalContent = contentText.replace(/\n/g, '<br>') + imageHtml + parentTag;

    if(!isAdmin) saveNickname(name);

    if(editingCommentId) {
        if(dbClient) {
            const { error } = await dbClient.from('comments').update({ content: finalContent }).eq('id', editingCommentId);
            if(error) showAlert("수정 실패");
            else {
                const post = posts.find(p => p.id == currentPostId);
                const cmtIndex = post.comments.findIndex(c => c.id == editingCommentId);
                if(cmtIndex !== -1) {
                    post.comments[cmtIndex].content = finalContent;
                }
                
                renderComments(post.comments);
                cancelCommentEdit();
            }
        }
        return;
    }

    if(isAdmin) { name = "하포카"; pw = ""; }
    else {
        if(!name) return showAlert("닉네임 입력");
        if(!pw) return showAlert("비번 입력");
        const banned = ['admin', '하포카', '관리자', '관리인'];
        if(banned.includes(name.toLowerCase())) return showAlert("사용할 수 없는 닉네임입니다.");
    }

    let finalPw = pw;
    if(!isAdmin && pw) finalPw = await sha256(pw);

    const { data, error } = await dbClient.rpc('create_comment_secure', {
        p_post_id: currentPostId,
        p_author: name,
        p_password: finalPw,
        p_content: finalContent
    });

    if(error) {
        showAlert("댓글 등록 실패: " + error.message);
    } else {
        const post = posts.find(p => p.id == currentPostId);
        if(!post.comments) post.comments = [];
        post.comments.push(data);
        renderComments(post.comments);
    }
    
    document.getElementById('cmtContent').value = '';
    document.getElementById('cmtPw').value = '';
    currentCommentImages = [];
    renderCommentImagePreview();
    cancelReply(); 
}

function insertImage(inp) { 
    if(inp.files && inp.files[0]) { 
        const file = inp.files[0];
        
        if (!file.type.match('image.*')) {
            showAlert("이미지 파일(JPG, PNG, GIF 등)만 업로드 가능합니다.");
            inp.value = ''; 
            return;
        }

        document.getElementById('global-loader').classList.remove('hidden');
        
        const insertToEditor = (url) => {
             if (currentEditorMode === 'html') {
                 document.getElementById('editorContentHtml').focus();
                 document.execCommand('insertHTML', false, `<img src="${url}"><p><br></p>`);
             } else {
                 const textarea = document.getElementById('editorContentMarkdown');
                 const start = textarea.selectionStart;
                 const end = textarea.selectionEnd;
                 const text = textarea.value;
                 const newText = text.substring(0, start) + `\n![이미지](${url})\n` + text.substring(end);
                 textarea.value = newText;
                 textarea.focus();
                 updateMarkdownPreview();
             }
        };

        if(dbClient) {
            const fileName = `img_${Date.now()}.${file.name.split('.').pop()}`;
            dbClient.storage.from('images').upload(fileName, file)
                .then(({ data, error }) => {
                    if(error) throw error;
                    const { data: { publicUrl } } = dbClient.storage.from('images').getPublicUrl(fileName);
                    insertToEditor(publicUrl);
                })
                .catch(err => {
                    const reader = new FileReader();
                    reader.onload = function(e) { insertToEditor(e.target.result); };
                    reader.readAsDataURL(file);
                })
                .finally(() => {
                    document.getElementById('global-loader').classList.add('hidden');
                    inp.value = ''; 
                });
        } else {
            const reader = new FileReader();
            reader.onload = function(e) {
                 insertToEditor(e.target.result);
                 document.getElementById('global-loader').classList.add('hidden');
                 inp.value = '';
            };
            reader.readAsDataURL(file);
        }
    } 
}

function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('flex');
    lightbox.classList.add('hidden');
}

function requestPasswordCheck(targetId, actionType) {
    let target = null;
    if(actionType.includes('post')) {
        target = posts.find(p => p.id == targetId);
    } else {
        const currentPost = posts.find(p => p.id == currentPostId);
        target = currentPost.comments.find(c => c.id == targetId || c.created_at == targetId); 
    }

    if (!target) return showAlert("해당 항목을 찾을 수 없습니다.");

    if(isAdmin) {
        executeAction(actionType, targetId, target);
        return;
    }

    if(target.author === '하포카' || target.author === 'Admin') {
        return showAlert("관리자 작성 항목은 수정/삭제할 수 없습니다.");
    }

    pendingActionType = actionType;
    pendingTargetId = targetId;
    pendingTarget = target; 
    
    document.getElementById('verificationPw').value = '';
    document.getElementById('passwordModal').classList.remove('hidden');
    document.getElementById('verificationPw').focus();
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.add('hidden');
}

async function confirmPasswordAction() {
    if(isAlertOpen) return;

    const inputPw = document.getElementById('verificationPw').value;
    if(!inputPw) return showAlert("비밀번호를 입력하세요.");

    if (!pendingTarget) {
        showAlert("대상 정보를 찾을 수 없습니다. 다시 시도해주세요.");
        closePasswordModal();
        return;
    }
    
    const hashedInput = await sha256(inputPw);
    const isMatch = (pendingTarget.password === inputPw) || (pendingTarget.password === hashedInput);

    if(isMatch) {
        const actionType = pendingActionType;
        const targetId = pendingTargetId;
        const targetObj = pendingTarget;

        closePasswordModal();

        pendingActionType = null;
        pendingTargetId = null;
        pendingTarget = null;
        
        setTimeout(() => {
            executeAction(actionType, targetId, targetObj);
        }, 300);
    } else {
        showAlert("비밀번호가 일치하지 않습니다.", "오류");
        document.getElementById('verificationPw').value = '';
    }
}

function executeAction(type, id, targetObj) {
    if(type === 'delete_post') {
        showConfirm("정말 이 게시글을 삭제하시겠습니까?", () => {
            deletePost(id);
        }, "게시글 삭제", "삭제하기");
    } else if(type === 'edit_post') {
        goEditMode(targetObj);
    } else if(type === 'delete_comment') {
        showConfirm("정말 이 댓글을 삭제하시겠습니까?", () => {
            deleteComment(id);
        }, "댓글 삭제", "삭제하기");
    } else if(type === 'edit_comment') {
        loadCommentForEdit(targetObj);
    }
}

function goEditMode(post) {
    editingPostId = post.id;
    currentBoardType = post.type;
    
    document.getElementById('write-header').innerText = "글 수정하기";
    document.getElementById('inputTitle').value = post.title;
    
    currentEditorMode = 'html';
    document.getElementById('editorContentHtml').innerHTML = post.content;
    document.getElementById('editorContentMarkdown').value = post.content; 
    
    document.getElementById('inputName').value = post.author;
    document.getElementById('inputName').disabled = true;
    document.getElementById('inputPw').disabled = true;
    document.getElementById('inputPw').placeholder = "수정 시 불필요";

    const checkPinned = document.getElementById('checkPinned');
    if(isAdmin) {
        document.getElementById('admin-write-options').classList.remove('hidden');
        checkPinned.checked = post.is_pinned || false;
    }
    
    switchEditorTab('html');
    router('write');
}

function loadCommentForEdit(cmt) {
    editingCommentId = cmt.id;
    document.getElementById('cmtName').value = cmt.author;
    document.getElementById('cmtName').disabled = true;
    document.getElementById('cmtPw').classList.add('hidden'); 
    
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = cmt.content;

    currentCommentImages = [];
    const imgs = tempDiv.querySelectorAll('img');
    imgs.forEach(img => {
        currentCommentImages.push(img.src);
    });

    let htmlContent = cmt.content.replace(/<!-- parent_id:.*? -->/g, '');
    tempDiv.innerHTML = htmlContent;
    
    const imagesInTemp = tempDiv.querySelectorAll('img');
    imagesInTemp.forEach(img => img.remove());
    
    let textOnly = tempDiv.innerHTML.replace(/<br\s*\/?>/gi, "\n").trim();
    if(textOnly.includes('<')) {
        let textParser = document.createElement('div');
        textParser.innerHTML = textOnly;
        textOnly = textParser.innerText;
    }

    document.getElementById('cmtContent').value = textOnly;
    
    document.getElementById('btn-submit-cmt').innerText = "수정완료";
    document.getElementById('btn-cmt-cancel').classList.remove('hidden');
    document.getElementById('cmtContent').focus();
    
    renderCommentImagePreview();
}

function cancelCommentEdit() {
    editingCommentId = null;
    document.getElementById('cmtName').value = isAdmin ? "하포카" : loadSavedNickname();
    document.getElementById('cmtName').disabled = isAdmin;
    if(!isAdmin) document.getElementById('cmtPw').classList.remove('hidden');
    document.getElementById('cmtPw').value = "";
    document.getElementById('cmtContent').value = "";
    document.getElementById('btn-submit-cmt').innerText = "등록";
    document.getElementById('btn-cmt-cancel').classList.add('hidden');
    currentCommentImages = [];
    renderCommentImagePreview();
}

async function deleteComment(id) {
    if(dbClient) {
        const { error } = await dbClient.from('comments').update({ 
            deleted_at: new Date().toISOString()
        }).eq('id', id);

        if(error) showAlert("삭제 실패: " + error.message);
        else {
            showAlert("삭제되었습니다.");
            if(!document.getElementById('view-admin').classList.contains('hidden')) {
                await fetchReportedItems();
                await fetchDeletedComments();
            } else {
                const post = posts.find(p => p.id == currentPostId);
                if(post && post.comments) {
                    post.comments = post.comments.filter(c => c.id != id);
                }
                renderComments(post ? post.comments : []);
            }
        }
    } else {
        const post = posts.find(p => p.id == currentPostId);
        post.comments = post.comments.filter(c => c.id != id);
        saveLocalPosts();
        renderComments(post.comments);
        showAlert("삭제되었습니다.");
    }
}

function confirmNavigation(targetPage) {
    if (targetPage === 'back') {
        targetPage = lastPage;
    }

    if (isWriting) {
        let content = "";
        if (currentEditorMode === 'html') content = document.getElementById('editorContentHtml').innerText.trim();
        else content = document.getElementById('editorContentMarkdown').value.trim();
        
        const t = document.getElementById('inputTitle').value; 
        
        if (t.length > 0 || content.length > 0) {
            let msg = "";
            let btnText = "";
            if(editingPostId) {
                msg = "수정사항이 저장되지 않으며,\n원래 내용으로 유지됩니다.";
                btnText = "이동";
            } else {
                msg = "작성 중인 내용이 삭제됩니다.\n이동하시겠습니까?";
                btnText = "삭제 후 이동";
            }

            showConfirm(msg, () => {
                resetEditor();
                router(targetPage);
            }, "페이지 이동", btnText);
            return;
        }
        resetEditor();
    } 
    else if (editingCommentId || document.getElementById('cmtContent').value.trim().length > 0) {
        let msg = editingCommentId ? "수정 중인 댓글이 초기화됩니다.\n이동하시겠습니까?" : "작성 중인 댓글이 삭제됩니다.\n이동하시겠습니까?";
        
        showConfirm(msg, () => {
            cancelCommentEdit();
            router(targetPage);
        }, "페이지 이동", "이동");
        return;
    }

    router(targetPage);
}

function toggleMobileMenu() { document.getElementById('mobile-menu').classList.toggle('hidden'); }
function openCategoryModal() { document.getElementById('categoryModal').classList.remove('hidden'); document.getElementById('btn-write-notice').classList.toggle('hidden', !isAdmin); }
function closeCategoryModal() { document.getElementById('categoryModal').classList.add('hidden'); }

function writePost(type) { 
    closeCategoryModal(); 
    currentBoardType = type; 
    editingPostId = null; 
    
    document.getElementById('write-header').innerText = type === 'notice' ? "📢 공지사항 작성" : (type === 'free' ? "💬 자유대화방 글쓰기" : "🛠️ 오류 질문 작성"); 
    
    const nameInput = document.getElementById('inputName');
    const pwInput = document.getElementById('inputPw');
    const pwContainer = document.getElementById('pw-container');
    
    if(isAdmin) {
        nameInput.value = "하포카";
        nameInput.disabled = true;
        pwInput.value = "";
        pwContainer.classList.add('hidden');
    } else {
        nameInput.value = loadSavedNickname();
        nameInput.disabled = false;
        
        pwInput.disabled = false;
        pwInput.value = "";
        pwInput.placeholder = "영문/숫자";
        pwContainer.classList.remove('hidden');
    }
    
    switchEditorTab('html');
    resetEditor();
    
    confirmNavigation('write'); 
}

function loadMore() { visibleCount += 9; renderBoard(); }

function toggleViewMode(mode) { 
    errorViewMode = mode; 
    document.getElementById('btn-grid').classList.toggle('view-btn-active', mode === 'grid');
    document.getElementById('btn-list').classList.toggle('view-btn-active', mode === 'list');
    renderBoard(); 
}

function resetEditor() { 
    document.getElementById('inputTitle').value=''; 
    document.getElementById('inputName').value=''; 
    document.getElementById('inputPw').value=''; 
    document.getElementById('editorContentHtml').innerHTML='';
    document.getElementById('editorContentMarkdown').value=''; 
    document.getElementById('markdown-preview').innerHTML='';
    editingPostId = null;
}

function submitPost() {
    const t = document.getElementById('inputTitle').value.trim(); 
    let n = document.getElementById('inputName').value.trim(); 
    let pw = document.getElementById('inputPw').value.trim(); 
    
    let finalContent = "";
    if (currentEditorMode === 'html') {
        finalContent = document.getElementById('editorContentHtml').innerHTML;
    } else {
        finalContent = document.getElementById('editorContentMarkdown').value;
    }
    
    let thumb = null;
    const htmlImgMatch = finalContent.match(/<img[^>]+src="([^">]+)"/);
    const mdImgMatch = finalContent.match(/!\[.*?\]\((.*?)\)/);
    
    if (htmlImgMatch && htmlImgMatch[1]) thumb = htmlImgMatch[1];
    else if (mdImgMatch && mdImgMatch[1]) thumb = mdImgMatch[1];

    if(!t) return showAlert('제목을 입력하세요.'); 
    const textCheck = finalContent.replace(/<[^>]*>/g, '').trim();
    if(!textCheck && !thumb) return showAlert('내용을 입력하세요.');

    if(isAdmin) {
        n = "하포카";
        pw = "";
    } else {
        const banned = ['admin', '하포카', '관리자', '관리인'];
        if(banned.includes(n.toLowerCase())) return showAlert("사용할 수 없는 닉네임입니다.");
        
        if(!editingPostId) {
            if(!/^[a-zA-Z0-9]{4,10}$/.test(pw)) return showAlert('비밀번호는 영문+숫자 4~10자여야 합니다.');
        }
        
        if(!n) n = '익명';
        if(!/^[가-힣0-9a-zA-Z]+$/.test(n)) return showAlert('닉네임은 한글/영문/숫자만 가능합니다.');
    }

    let postData = { title: t, content: finalContent, image: thumb };
    if(!editingPostId) {
        postData.author = n;
        postData.password = pw;
        postData.type = currentBoardType;
    }

    savePostToDB(postData);
}

function openAdminLogin() { if(!isAdmin) document.getElementById('adminModal').classList.remove('hidden'); }
function closeAdminModal() { document.getElementById('adminModal').classList.add('hidden'); }

async function tryAdminLogin() {
    const email = document.getElementById('adminEmail').value;
    const pw = document.getElementById('adminPw').value;
    
    if(!email || !pw) return showAlert('이메일과 비밀번호를 입력하세요.');
    
    if(!dbClient) return showAlert('DB 연결 오류');

    const { data, error } = await dbClient.auth.signInWithPassword({
        email: email,
        password: pw
    });

    if(error) {
        showAlert('로그인 실패: ' + error.message);
    } else {
        closeAdminModal();
        showAlert('관리자 로그인 성공');
        document.getElementById('adminEmail').value = '';
        document.getElementById('adminPw').value = '';
    }
}

async function adminLogout() { 
    showConfirm('로그아웃 하시겠습니까?', async () => { 
        if(dbClient) await dbClient.auth.signOut();
        isAdmin=false; 
        updateAdminUI(); 
        router('home'); 
        showAlert("로그아웃 되었습니다.");
    }, "로그아웃", "로그아웃");
}

function updateAdminUI() { 
    const b = document.getElementById('navAdminBadge'); 
    const mb = document.getElementById('mobileAdminBadge'); 
    const d = document.getElementById('btn-admin-dash'); 
    const dm = document.getElementById('btn-admin-dash-m'); 
    const show = isAdmin ? 'remove' : 'add'; 
    b.classList[show]('hidden'); 
    mb.classList[show]('hidden'); 
    d.classList[show]('hidden'); 
    dm.classList[show]('hidden'); 
    
    const cmtName = document.getElementById('cmtName');
    const cmtPw = document.getElementById('cmtPw');
    if(isAdmin) {
        cmtName.value = "하포카"; cmtName.disabled = true;
        cmtPw.value = ""; cmtPw.classList.add('hidden');
    } else {
        cmtName.value = loadSavedNickname(); cmtName.disabled = false;
        if(!editingCommentId) cmtPw.classList.remove('hidden');
    }
}

async function deletePost(id) { 
    if(dbClient) { 
        const { error } = await dbClient.from('posts').update({ 
            deleted_at: new Date().toISOString(),
            status: 'deleted'
        }).eq('id', id);

        if(!error) fetchPosts(currentBoardType); 
    } else { 
        posts = posts.filter(p => p.id != id); 
        saveLocalPosts(); 
        renderBoard(); 
    }
    
    showAlert("삭제되었습니다.");
    if(!document.getElementById('view-detail').classList.contains('hidden')) router(currentBoardType); 
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
        const tag = e.target.tagName;
        const isEditable = e.target.isContentEditable;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !isEditable) {
            e.preventDefault();
            confirmNavigation('back');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('cmt-drop-zone');
    const overlay = document.getElementById('drop-zone-overlay');
    
    if(dropZone && overlay) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
        
        dropZone.addEventListener('dragenter', () => overlay.classList.remove('hidden'));
        dropZone.addEventListener('dragleave', (e) => {
            if (e.relatedTarget && !dropZone.contains(e.relatedTarget)) {
                overlay.classList.add('hidden');
            }
        });
        dropZone.addEventListener('drop', (e) => {
            overlay.classList.add('hidden');
            if(e.dataTransfer.files.length > 0) {
                const input = document.getElementById('commentImgInput');
                uploadCommentImage({ files: e.dataTransfer.files });
            }
        });
    }
});

window.onload = () => { 
    const loader = document.getElementById('global-loader');
    if(loader) loader.classList.remove('hidden');

    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));

    loadLocalPosts(); 
    const initialHash = window.location.hash.replace('#', '');
    
    const realPage = getPageFromCode(initialHash); 
    
    if (realPage === 'detail') { 
        const savedId = localStorage.getItem('aa_current_post_id');
        if (savedId) {
            readPost(savedId).then(() => {
                if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            }).catch(e => {
                router('home', false);
                if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            });
        } else {
            router('home', false);
            if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
        }
    } else {
        router(realPage, false);
        if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
    }
    
    recordVisit(); 
};
