import { ADMIN_PAGE_SIZE } from './config.js';
import { getDbClient } from './api.js';
import { showAlert, showConfirm, showContentModal, renderPagination } from './ui.js';
import { escapeHtml } from './utils.js';

let currentAdminTab = 'dashboard';
let ipSearchData = { posts: [], comments: [] };
let deletedPostsData = [];
let deletedCommentsData = [];
let ipSearchPage = 0;
let deletedPostPage = 0;
let deletedCommentPage = 0;
let visitorChartInstance = null;

export function switchAdminTab(tabName) {
    currentAdminTab = tabName;
    ['dashboard', 'deleted-posts', 'deleted-comments', 'reported', 'ip-search'].forEach(t => {
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
    if (tabName === 'ip-search') {
        document.getElementById('adminIpSearchInput').focus();
        if(ipSearchData.posts.length > 0 || ipSearchData.comments.length > 0) {
            const container = document.getElementById('admin-ip-search-results');
            container.innerHTML = '';
            ipSearchPage = 0;
            renderIpSearchResults();
        }
    }
}

export async function updateAdminStats() {
    const dbClient = getDbClient();
    if(!dbClient) return;
    
    const { count } = await dbClient.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null);
    document.getElementById('stat-total-posts').innerText = count || 0;
    
    const { count: banCount } = await dbClient.from('banned_ips').select('*', { count: 'exact', head: true });
    document.getElementById('stat-banned-count').innerText = banCount || 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const { data: todayData } = await dbClient.from('daily_stats').select('visitors').eq('date', today).single();
    const { data: yesterdayData } = await dbClient.from('daily_stats').select('visitors').eq('date', yesterday).single();
    
    document.getElementById('stat-today-visits').innerText = todayData ? todayData.visitors : 0;
    document.getElementById('stat-yesterday-visits').innerText = yesterdayData ? yesterdayData.visitors : 0;

    fetchRecentPostsAdmin();
    fetchBanList();
    loadVisitorChart(); 
}

async function loadVisitorChart() {
    const dbClient = getDbClient();
    if(!dbClient) return;
    const ctx = document.getElementById('visitorChart');
    if(!ctx) return;

    const { data: stats } = await dbClient.from('daily_stats').select('*').order('date', { ascending: true }).limit(7);
    
    if(!stats) return;

    if(visitorChartInstance) {
        visitorChartInstance.destroy();
    }

    const labels = stats.map(s => s.date.substring(5)); 
    const values = stats.map(s => s.visitors);

    visitorChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '방문자 수',
                data: values,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#2563eb',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, font: { family: 'Pretendard' } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard' } } }
            }
        }
    });
}

async function fetchRecentPostsAdmin() {
    const dbClient = getDbClient();
    const list = document.getElementById('recent-posts-admin');
    if(!list || !dbClient) return;

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
            li.onclick = () => { window.readPost(post.id); };
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

export async function fetchBanList() {
    const dbClient = getDbClient();
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
                <button onclick="window.removeBan('${ban.ip}')" class="text-red-500 hover:text-red-700 text-xs font-bold">해제</button>
            `;
            list.appendChild(li);
        });
    } else {
        list.innerHTML = '<li class="text-center text-slate-400 text-xs">차단된 IP가 없거나 권한이 없습니다.</li>';
    }
}

export async function addBan() {
    const dbClient = getDbClient();
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

export async function removeBan(ip) {
    const dbClient = getDbClient();
    if(!confirm(`IP ${ip}의 차단을 해제하시겠습니까?`)) return;
    const { error } = await dbClient.from('banned_ips').delete().eq('ip', ip);
    if(error) showAlert("해제 실패");
    else {
        fetchBanList();
    }
}

export async function fetchDeletedPosts() {
    const dbClient = getDbClient();
    if(!dbClient) return;
    const list = document.getElementById('deleted-posts-list');
    const noData = document.getElementById('no-deleted-posts');
    list.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 불러오는 중...</div>';
    
    const chkAll = document.getElementById('chk-all-posts');
    if(chkAll) chkAll.checked = false;

    const { data, error } = await dbClient.from('posts').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });

    list.innerHTML = '';
    if (!data || data.length === 0) {
        noData.classList.remove('hidden');
        document.getElementById('pagination-deleted-posts').innerHTML = ''; 
        return;
    }
    noData.classList.add('hidden');

    deletedPostsData = data;
    deletedPostPage = 0;
    renderDeletedPosts();
}

function renderDeletedPosts() {
    const dbClient = getDbClient();
    const list = document.getElementById('deleted-posts-list');
    list.innerHTML = ''; 

    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    const start = deletedPostPage * ADMIN_PAGE_SIZE;
    const end = start + ADMIN_PAGE_SIZE;
    const pageData = deletedPostsData.slice(start, end);

    if(pageData.length === 0 && deletedPostPage === 0) {
        document.getElementById('no-deleted-posts').classList.remove('hidden');
        return;
    }

    pageData.forEach(async post => {
        const delDate = new Date(post.deleted_at);
        const elapsed = now - delDate;
        
        if (elapsed > thirtyDays) {
            await dbClient.from('posts').delete().eq('id', post.id);
            return;
        }

        const remainDays = 30 - Math.floor(elapsed / (24 * 60 * 60 * 1000));
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition";
        div.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && e.target.type !== 'checkbox') window.readPost(post.id);
        };
        const ipDisplay = post.ip ? `<span class="text-xs text-red-300 font-bold ml-1">(${post.ip})</span>` : '';

        div.innerHTML = `
            <input type="checkbox" class="del-chk-post w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" value="${post.id}" onclick="event.stopPropagation()">
            <div class="flex-grow min-w-0">
                <div class="font-bold text-slate-700 line-clamp-1">${escapeHtml(post.title)}</div>
                <div class="text-xs text-red-400 mt-1">삭제일: ${delDate.toLocaleDateString()} (영구 삭제까지 ${remainDays}일)</div>
                <div class="text-xs text-slate-400">작성자: ${escapeHtml(post.author)}${ipDisplay}</div>
            </div>
            <div class="flex flex-col gap-2 shrink-0">
                <button onclick="event.stopPropagation(); window.restorePost('${post.id}')" class="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition whitespace-nowrap">복구</button>
                <button onclick="event.stopPropagation(); window.permanentlyDeletePost('${post.id}')" class="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">영구삭제</button>
            </div>
        `;
        list.appendChild(div);
    });

    renderPagination('pagination-deleted-posts', deletedPostsData.length, ADMIN_PAGE_SIZE, deletedPostPage + 1, (newPage) => {
        deletedPostPage = newPage - 1;
        renderDeletedPosts();
    });
}

export async function fetchDeletedComments() {
    const dbClient = getDbClient();
    if(!dbClient) return;
    const list = document.getElementById('deleted-comments-list');
    const noData = document.getElementById('no-deleted-comments');
    list.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 불러오는 중...</div>';

    const chkAll = document.getElementById('chk-all-comments');
    if(chkAll) chkAll.checked = false;
    
    const { data } = await dbClient.from('comments').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });

    list.innerHTML = '';
    if (!data || data.length === 0) {
        noData.classList.remove('hidden');
        document.getElementById('pagination-deleted-comments').innerHTML = ''; 
        return;
    }
    noData.classList.add('hidden');

    deletedCommentsData = data;
    deletedCommentPage = 0;
    renderDeletedComments();
}

function renderDeletedComments() {
    const dbClient = getDbClient();
    const list = document.getElementById('deleted-comments-list');
    list.innerHTML = ''; 
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const start = deletedCommentPage * ADMIN_PAGE_SIZE;
    const end = start + ADMIN_PAGE_SIZE;
    const pageData = deletedCommentsData.slice(start, end);
    
    if(pageData.length === 0 && deletedCommentPage === 0) {
        document.getElementById('no-deleted-comments').classList.remove('hidden');
        return;
    }

    pageData.forEach(async cmt => {
        const delDate = new Date(cmt.deleted_at);
        const elapsed = now - delDate;
        if (elapsed > thirtyDays) {
            await dbClient.from('comments').delete().eq('id', cmt.id);
            return;
        }
        const remainDays = 30 - Math.floor(elapsed / (24 * 60 * 60 * 1000));
        const cleanContent = cmt.content.replace(/<[^>]*>/g, ' ').substring(0, 50);
        const ipDisplay = cmt.ip ? `<span class="text-xs text-red-300 font-bold ml-1">(${cmt.ip})</span>` : '';

        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition";
        div.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && e.target.type !== 'checkbox') showContentModal(cmt.content, "삭제된 댓글 내용");
        };
        
        div.innerHTML = `
            <input type="checkbox" class="del-chk-comment w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" value="${cmt.id}" onclick="event.stopPropagation()">
            <div class="flex-grow min-w-0">
                <div class="font-bold text-slate-700 line-clamp-1">${escapeHtml(cleanContent)}...</div>
                <div class="text-xs text-red-400 mt-1">삭제일: ${delDate.toLocaleDateString()} (영구 삭제까지 ${remainDays}일)</div>
                <div class="text-xs text-slate-400">작성자: ${escapeHtml(cmt.author)}${ipDisplay}</div>
            </div>
            <div class="flex flex-col gap-2 shrink-0">
                <button onclick="event.stopPropagation(); window.restoreComment('${cmt.id}')" class="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition whitespace-nowrap">복구</button>
                <button onclick="event.stopPropagation(); window.permanentlyDeleteComment('${cmt.id}')" class="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">영구삭제</button>
            </div>
        `;
        list.appendChild(div);
    });

    renderPagination('pagination-deleted-comments', deletedCommentsData.length, ADMIN_PAGE_SIZE, deletedCommentPage + 1, (newPage) => {
        deletedCommentPage = newPage - 1;
        renderDeletedComments();
    });
}

export async function restorePost(id) {
    const dbClient = getDbClient();
    if(!confirm("이 게시글을 복구하시겠습니까?")) return;
    const { error } = await dbClient.from('posts').update({ deleted_at: null, status: 'restored' }).eq('id', id);
    if(error) showAlert("복구 실패: " + error.message);
    else {
        showAlert("게시글이 복구되었습니다.");
        fetchDeletedPosts();
    }
}

export async function permanentlyDeletePost(id) {
    const dbClient = getDbClient();
    showConfirm("이 게시글을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.", async () => {
        const { error } = await dbClient.from('posts').delete().eq('id', id);
        if(error) showAlert("삭제 실패: " + error.message);
        else {
            showAlert("영구 삭제되었습니다.");
            fetchDeletedPosts();
        }
    }, "영구 삭제 확인", "영구 삭제");
}

export async function restoreComment(id) {
    const dbClient = getDbClient();
    if(!confirm("이 댓글을 복구하시겠습니까?")) return;
    const { error } = await dbClient.from('comments').update({ deleted_at: null }).eq('id', id);
    if(error) showAlert("복구 실패");
    else {
        showAlert("댓글이 복구되었습니다.");
        fetchDeletedComments();
    }
}

export async function permanentlyDeleteComment(id) {
    const dbClient = getDbClient();
    showConfirm("이 댓글을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.", async () => {
        const { error } = await dbClient.from('comments').delete().eq('id', id);
        if(error) showAlert("삭제 실패: " + error.message);
        else {
            showAlert("영구 삭제되었습니다.");
            fetchDeletedComments();
        }
    }, "영구 삭제 확인", "영구 삭제");
}

export async function adminSearchByIp() {
    const dbClient = getDbClient();
    if(!dbClient) return;
    const input = document.getElementById('adminIpSearchInput');
    const ip = input.value.trim();
    if(!ip) return showAlert("검색할 IP 주소를 입력하세요.");

    const resultContainer = document.getElementById('admin-ip-search-results');
    resultContainer.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 검색 중...</div>';

    try {
        const { data: posts } = await dbClient.from('posts').select('*').eq('ip', ip).order('created_at', { ascending: false });
        const { data: comments } = await dbClient.from('comments').select('*').eq('ip', ip).order('created_at', { ascending: false });

        ipSearchData = { posts: posts || [], comments: comments || [] };
        ipSearchPage = 0;
        renderIpSearchResults();
    } catch(e) {
        resultContainer.innerHTML = `<div class="text-center py-4 text-red-500">검색 중 오류 발생: ${e.message}</div>`;
    }
}

function renderIpSearchResults() {
    const container = document.getElementById('admin-ip-search-results');
    const combinedData = [];

    ipSearchData.posts.forEach(p => combinedData.push({ type: 'post', data: p, date: new Date(p.created_at) }));
    ipSearchData.comments.forEach(c => combinedData.push({ type: 'comment', data: c, date: new Date(c.created_at) }));
    
    combinedData.sort((a, b) => b.date - a.date);

    const start = ipSearchPage * ADMIN_PAGE_SIZE;
    const end = start + ADMIN_PAGE_SIZE;
    const pageData = combinedData.slice(start, end);

    if (ipSearchPage === 0) container.innerHTML = '';
    
    if (combinedData.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400">해당 IP로 작성된 글이나 댓글이 없습니다.</div>';
        return;
    }

    if (ipSearchPage === 0) {
        const header = document.createElement('div');
        header.className = "mb-4 text-sm text-slate-500 font-bold";
        header.innerText = `총 ${combinedData.length}건 검색됨`;
        container.appendChild(header);
    }

    pageData.forEach(item => {
        const isPost = item.type === 'post';
        const obj = item.data;
        const isDeleted = !!obj.deleted_at;
        const div = document.createElement('div');
        div.className = `bg-white p-3 rounded-lg border ${isDeleted ? 'border-red-200 bg-red-50' : 'border-slate-200'} shadow-sm hover:bg-slate-50 cursor-pointer mb-2`;
        
        if (isPost) {
            div.onclick = () => window.readPost(obj.id);
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="truncate mr-2">
                        <span class="text-xs font-bold text-blue-600 mr-1">[${obj.type}]</span>
                        ${isDeleted ? '<span class="text-xs font-bold text-red-600 mr-1">[삭제됨]</span>' : ''}
                        <span class="text-sm font-medium text-slate-800">${escapeHtml(obj.title)}</span>
                    </div>
                    <div class="text-xs text-slate-400 whitespace-nowrap">${item.date.toLocaleDateString()}</div>
                </div>`;
        } else {
            div.onclick = () => showContentModal(obj.content, "댓글 내용");
            const cleanContent = obj.content.replace(/<[^>]*>/g, ' ').substring(0, 40);
            div.innerHTML = `
                <div class="text-sm text-slate-700 mb-1 line-clamp-1">
                    ${isDeleted ? '<span class="text-xs font-bold text-red-600 mr-1">[삭제됨]</span>' : ''}
                    <i class="fa-regular fa-comment-dots mr-1 text-slate-400"></i>${escapeHtml(cleanContent)}...
                </div>
                <div class="flex justify-between items-center text-xs text-slate-400">
                    <span>작성자: ${escapeHtml(obj.author)}</span>
                    <span>${item.date.toLocaleDateString()}</span>
                </div>`;
        }
        container.appendChild(div);
    });

    if (combinedData.length > end) {
        const btn = document.createElement('button');
        btn.className = "w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition mt-2";
        btn.innerHTML = `더 보기 (${combinedData.length - end}개 남음)`;
        btn.onclick = () => { ipSearchPage++; renderIpSearchResults(); };
        container.appendChild(btn);
    }
}

export function toggleSelectAll(type, checked) {
    const className = type === 'post' ? 'del-chk-post' : 'del-chk-comment';
    document.querySelectorAll(`.${className}`).forEach(cb => cb.checked = checked);
}

export async function fetchReportedItems() {
    const dbClient = getDbClient();
    if(!dbClient) return;
    const container = document.getElementById('reported-list');
    container.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 불러오는 중...</div>';
    
    const { data: posts } = await dbClient.from('posts').select('*').gte('reports', 1).order('reports', {ascending:false});
    const { data: comments } = await dbClient.from('comments').select('*').gte('reports', 1).order('reports', {ascending:false});

    container.innerHTML = '';
    const all = [...(posts||[]).map(p=>({...p, _type:'post'})), ...(comments||[]).map(c=>({...c, _type:'comment'}))];
    
    if(all.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400">신고된 항목이 없습니다.</div>';
        return;
    }

    all.forEach(item => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl border border-red-200 bg-red-50 flex items-center justify-between mb-2";
        const content = item._type === 'post' ? item.title : item.content.replace(/<[^>]*>/g, '').substring(0,30);
        div.innerHTML = `
            <div>
                <span class="text-xs font-bold text-red-600 mr-2">[${item._type==='post'?'게시글':'댓글'}] 신고 ${item.reports}회</span>
                <span class="text-sm font-bold text-slate-700 pointer-events-none">${escapeHtml(content)}</span>
            </div>
            <div>
                <button onclick="window.clearReports('${item._type}', '${item.id}')" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 mr-2">신고 초기화</button>
                <button onclick="${item._type==='post' ? `window.deletePost('${item.id}')` : `window.deleteComment('${item.id}')`}" class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">삭제</button>
            </div>
        `;
        container.appendChild(div);
    });
}

export async function clearReports(type, id) {
    const dbClient = getDbClient();
    if(!confirm("신고 횟수를 초기화하시겠습니까?")) return;
    const table = type === 'post' ? 'posts' : 'comments';
    const { error } = await dbClient.from(table).update({ reports: 0, reported_by: [] }).eq('id', id);
    if(error) showAlert("초기화 실패");
    else {
        showAlert("신고가 초기화되었습니다.");
        fetchReportedItems();
    }
}
