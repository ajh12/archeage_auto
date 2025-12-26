var ipSearchData = { posts: [], comments: [] };
var deletedPostsData = [];
var deletedCommentsData = [];
var ipSearchPage = 0;
var deletedPostPage = 0;
var deletedCommentPage = 0;
var visitorChartInstance = null;

function switchAdminTab(tabName) {
    var tabs = ['dashboard', 'deleted-posts', 'deleted-comments', 'reported', 'ip-search'];
    tabs.forEach(function(t) {
        var btn = document.getElementById('tab-admin-' + t);
        var content = document.getElementById('admin-view-' + t);
        
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
            var container = document.getElementById('admin-ip-search-results');
            container.innerHTML = '';
            ipSearchPage = 0;
            renderIpSearchResults();
        }
    }
}

async function updateAdminStats() {
    var dbClient = getDbClient();
    if(!dbClient) return;
    
    var postsCount = await dbClient.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null);
    document.getElementById('stat-total-posts').innerText = postsCount.count || 0;
    
    var banCount = await dbClient.from('banned_ips').select('*', { count: 'exact', head: true });
    document.getElementById('stat-banned-count').innerText = banCount.count || 0;

    var today = new Date().toISOString().split('T')[0];
    var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    var todayStats = await dbClient.from('daily_stats').select('visitors').eq('date', today).single();
    var yesterdayStats = await dbClient.from('daily_stats').select('visitors').eq('date', yesterday).single();
    
    document.getElementById('stat-today-visits').innerText = todayStats.data ? todayStats.data.visitors : 0;
    document.getElementById('stat-yesterday-visits').innerText = yesterdayStats.data ? yesterdayStats.data.visitors : 0;

    fetchRecentPostsAdmin();
    fetchBanList();
    loadVisitorChart(); 
}

async function loadVisitorChart() {
    var dbClient = getDbClient();
    if(!dbClient) return;
    var ctx = document.getElementById('visitorChart');
    if(!ctx) return;

    var res = await dbClient.from('daily_stats').select('*').order('date', { ascending: false }).limit(7);
    var stats = res.data;
    if(!stats) return;

    stats.reverse();

    if(visitorChartInstance) {
        visitorChartInstance.destroy();
    }

    var labels = stats.map(function(s) { return s.date.substring(5); });
    var values = stats.map(function(s) { return s.visitors; });

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
    var dbClient = getDbClient();
    var list = document.getElementById('recent-posts-admin');
    if(!list || !dbClient) return;

    var res = await dbClient.from('posts').select('*').neq('type', 'notice').is('deleted_at', null).order('created_at', { ascending: false }).limit(7);
    var data = res.data;

    list.innerHTML = '';
    
    if(data && data.length > 0) {
        data.forEach(function(post) {
            var date = new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
            var typeBadge = post.type === 'free' ? '<span class="text-slate-400 text-xs mr-1">[자유]</span>' : '<span class="text-red-400 text-xs mr-1">[질문]</span>';
            
            var li = document.createElement('li');
            li.className = "flex justify-between items-center py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 px-2 rounded transition";
            li.onclick = function() { readPost(post.id); };
            li.innerHTML = '<div class="truncate mr-2 flex items-center">' + typeBadge + '<span class="text-slate-700 font-bold text-sm truncate">' + escapeHtml(post.title) + '</span></div><div class="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">' + date + '</div>';
            list.appendChild(li);
        });
    } else {
        list.innerHTML = '<li class="text-center text-slate-400 py-4 text-xs">최근 글이 없습니다.</li>';
    }
}

async function fetchBanList() {
    var dbClient = getDbClient();
    var list = document.getElementById('banList');
    if(!list || !dbClient) return;
    
    var res = await dbClient.from('banned_ips').select('*').order('created_at', { ascending: false });
    var data = res.data;
    list.innerHTML = '';
    
    if(data && data.length > 0) {
        data.forEach(function(ban) {
            var li = document.createElement('li');
            li.className = "flex justify-between items-center bg-white p-2 rounded border border-slate-200";
            li.innerHTML = '<span>' + ban.ip + ' <span class="text-xs text-slate-400">(' + ban.reason + ')</span></span><button onclick="removeBan(\'' + ban.ip + '\')" class="text-red-500 hover:text-red-700 text-xs font-bold">해제</button>';
            list.appendChild(li);
        });
    } else {
        list.innerHTML = '<li class="text-center text-slate-400 text-xs">차단된 IP가 없거나 권한이 없습니다.</li>';
    }
}

async function addBan() {
    var dbClient = getDbClient();
    var input = document.getElementById('banInput');
    var ip = input.value.trim();
    if(!ip) return showAlert("IP를 입력하세요.");
    if(!dbClient) return;

    var res = await dbClient.from('banned_ips').insert([{ ip: ip, reason: "관리자 수동 차단" }]);
    if(res.error) showAlert("차단 실패: " + res.error.message);
    else {
        showAlert("해당 IP가 차단되었습니다.");
        input.value = '';
        fetchBanList();
    }
}

async function removeBan(ip) {
    var dbClient = getDbClient();
    if(!confirm('IP ' + ip + '의 차단을 해제하시겠습니까?')) return;
    var res = await dbClient.from('banned_ips').delete().eq('ip', ip);
    if(res.error) showAlert("해제 실패");
    else {
        fetchBanList();
    }
}

async function fetchDeletedPosts() {
    var dbClient = getDbClient();
    if(!dbClient) return;
    var list = document.getElementById('deleted-posts-list');
    var noData = document.getElementById('no-deleted-posts');
    list.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 불러오는 중...</div>';
    
    var chkAll = document.getElementById('chk-all-posts');
    if(chkAll) chkAll.checked = false;

    var res = await dbClient.from('posts').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    var data = res.data;

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
    var dbClient = getDbClient();
    var list = document.getElementById('deleted-posts-list');
    list.innerHTML = ''; 

    var now = new Date();
    var thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    var start = deletedPostPage * ADMIN_PAGE_SIZE;
    var end = start + ADMIN_PAGE_SIZE;
    var pageData = deletedPostsData.slice(start, end);

    if(pageData.length === 0 && deletedPostPage === 0) {
        document.getElementById('no-deleted-posts').classList.remove('hidden');
        return;
    }

    pageData.forEach(async function(post) {
        var delDate = new Date(post.deleted_at);
        var elapsed = now - delDate;
        
        if (elapsed > thirtyDays) {
            await dbClient.from('posts').delete().eq('id', post.id);
            return;
        }

        var remainDays = 30 - Math.floor(elapsed / (24 * 60 * 60 * 1000));
        
        var isReportedMany = (post.reports && post.reports >= 5);
        var cardClass = isReportedMany 
            ? "bg-red-50 p-4 rounded-xl border border-red-500 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-red-100 transition"
            : "bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition";
            
        var badgeHtml = isReportedMany ? '<span class="text-red-600 font-bold mr-2">[신고누적]</span>' : '';

        var div = document.createElement('div');
        div.className = cardClass;
        div.onclick = function(e) {
            if(e.target.tagName !== 'BUTTON' && e.target.type !== 'checkbox') readPost(post.id);
        };
        var ipDisplay = post.ip ? '<span class="text-xs text-red-300 font-bold ml-1">(' + post.ip + ')</span>' : '';

        div.innerHTML = '<input type="checkbox" class="del-chk-post w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" value="' + post.id + '" onclick="event.stopPropagation()"><div class="flex-grow min-w-0"><div class="font-bold text-slate-700 line-clamp-1">' + badgeHtml + escapeHtml(post.title) + '</div><div class="text-xs text-red-400 mt-1">삭제일: ' + delDate.toLocaleDateString() + ' (영구 삭제까지 ' + remainDays + '일)</div><div class="text-xs text-slate-400">작성자: ' + escapeHtml(post.author) + ipDisplay + '</div></div><div class="flex flex-col gap-2 shrink-0"><button onclick="event.stopPropagation(); restorePost(\'' + post.id + '\')" class="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition whitespace-nowrap">복구</button><button onclick="event.stopPropagation(); permanentlyDeletePost(\'' + post.id + '\')" class="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">영구삭제</button></div>';
        list.appendChild(div);
    });

    renderPagination('pagination-deleted-posts', deletedPostsData.length, ADMIN_PAGE_SIZE, deletedPostPage + 1, function(newPage) {
        deletedPostPage = newPage - 1;
        renderDeletedPosts();
    });
}

async function fetchDeletedComments() {
    var dbClient = getDbClient();
    if(!dbClient) return;
    var list = document.getElementById('deleted-comments-list');
    var noData = document.getElementById('no-deleted-comments');
    list.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 불러오는 중...</div>';

    var chkAll = document.getElementById('chk-all-comments');
    if(chkAll) chkAll.checked = false;
    
    var res = await dbClient.from('comments').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    var data = res.data;

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
    var dbClient = getDbClient();
    var list = document.getElementById('deleted-comments-list');
    list.innerHTML = ''; 

    var now = new Date();
    var thirtyDays = 30 * 24 * 60 * 60 * 1000;

    var start = deletedCommentPage * ADMIN_PAGE_SIZE;
    var end = start + ADMIN_PAGE_SIZE;
    var pageData = deletedCommentsData.slice(start, end);
    
    if(pageData.length === 0 && deletedCommentPage === 0) {
        document.getElementById('no-deleted-comments').classList.remove('hidden');
        return;
    }

    pageData.forEach(async function(cmt) {
        var delDate = new Date(cmt.deleted_at);
        var elapsed = now - delDate;
        
        if (elapsed > thirtyDays) {
            await dbClient.from('comments').delete().eq('id', cmt.id);
            return;
        }

        var remainDays = 30 - Math.floor(elapsed / (24 * 60 * 60 * 1000));
        var cleanContent = cmt.content.replace(/<[^>]*>/g, ' ').substring(0, 50);
        var ipDisplay = cmt.ip ? '<span class="text-xs text-red-300 font-bold ml-1">(' + cmt.ip + ')</span>' : '';

        var isReportedMany = (cmt.reports && cmt.reports >= 5);
        var cardClass = isReportedMany 
            ? "bg-red-50 p-4 rounded-xl border border-red-500 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-red-100 transition"
            : "bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition";
            
        var badgeHtml = isReportedMany ? '<span class="text-red-600 font-bold mr-2">[신고누적]</span>' : '';

        var div = document.createElement('div');
        div.className = cardClass;
        div.onclick = function(e) {
            if(e.target.tagName !== 'BUTTON' && e.target.type !== 'checkbox') {
                showContentModal(cmt.content, "삭제된 댓글 내용");
            }
        };
        
        div.innerHTML = '<input type="checkbox" class="del-chk-comment w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" value="' + cmt.id + '" onclick="event.stopPropagation()"><div class="flex-grow min-w-0"><div class="font-bold text-slate-700 line-clamp-1">' + badgeHtml + escapeHtml(cleanContent) + '...</div><div class="text-xs text-red-400 mt-1">삭제일: ' + delDate.toLocaleDateString() + ' (영구 삭제까지 ' + remainDays + '일)</div><div class="text-xs text-slate-400">작성자: ' + escapeHtml(cmt.author) + ipDisplay + '</div></div><div class="flex flex-col gap-2 shrink-0"><button onclick="event.stopPropagation(); restoreComment(\'' + cmt.id + '\')" class="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition whitespace-nowrap">복구</button><button onclick="event.stopPropagation(); permanentlyDeleteComment(\'' + cmt.id + '\')" class="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition whitespace-nowrap">영구삭제</button></div>';
        list.appendChild(div);
    });

    renderPagination('pagination-deleted-comments', deletedCommentsData.length, ADMIN_PAGE_SIZE, deletedCommentPage + 1, function(newPage) {
        deletedCommentPage = newPage - 1;
        renderDeletedComments();
    });
}

function restorePost(id) {
    var dbClient = getDbClient();
    showConfirm("이 게시글을 복구하시겠습니까?", async function() {
        var res = await dbClient.from('posts').update({ deleted_at: null, status: 'restored' }).eq('id', id);
        if(res.error) showAlert("복구 실패: " + res.error.message);
        else {
            showAlert("게시글이 복구되었습니다.");
            fetchDeletedPosts();
        }
    }, "게시글 복구", "복구");
}

async function permanentlyDeletePost(id) {
    var dbClient = getDbClient();
    showConfirm("이 게시글을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.", async function() {
        var res = await dbClient.from('posts').delete().eq('id', id);
        if(res.error) showAlert("삭제 실패: " + res.error.message);
        else {
            showAlert("영구 삭제되었습니다.");
            fetchDeletedPosts();
        }
    }, "영구 삭제 확인", "영구 삭제");
}

function restoreComment(id) {
    var dbClient = getDbClient();
    showConfirm("이 댓글을 복구하시겠습니까?", async function() {
        var res = await dbClient.from('comments').update({ deleted_at: null }).eq('id', id);
        if(res.error) showAlert("복구 실패");
        else {
            showAlert("댓글이 복구되었습니다.");
            fetchDeletedComments();
        }
    }, "댓글 복구", "복구");
}

async function permanentlyDeleteComment(id) {
    var dbClient = getDbClient();
    showConfirm("이 댓글을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.", async function() {
        var res = await dbClient.from('comments').delete().eq('id', id);
        if(res.error) showAlert("삭제 실패: " + res.error.message);
        else {
            showAlert("영구 삭제되었습니다.");
            fetchDeletedComments();
        }
    }, "영구 삭제 확인", "영구 삭제");
}

async function adminSearchByIp() {
    var dbClient = getDbClient();
    if(!dbClient) return;
    var input = document.getElementById('adminIpSearchInput');
    var ip = input.value.trim();
    if(!ip) return showAlert("검색할 IP 주소를 입력하세요.");

    var resultContainer = document.getElementById('admin-ip-search-results');
    resultContainer.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> 검색 중...</div>';

    try {
        var postRes = await dbClient.from('posts').select('*').eq('ip', ip).order('created_at', { ascending: false });
        var cmtRes = await dbClient.from('comments').select('*').eq('ip', ip).order('created_at', { ascending: false });

        ipSearchData = { posts: postRes.data || [], comments: cmtRes.data || [] };
        ipSearchPage = 0;
        renderIpSearchResults();
    } catch(e) {
        resultContainer.innerHTML = '<div class="text-center py-4 text-red-500">검색 중 오류 발생: ' + e.message + '</div>';
    }
}

function renderIpSearchResults() {
    var container = document.getElementById('admin-ip-search-results');
    var combinedData = [];

    ipSearchData.posts.forEach(function(p) { combinedData.push({ type: 'post', data: p, date: new Date(p.created_at) }); });
    ipSearchData.comments.forEach(function(c) { combinedData.push({ type: 'comment', data: c, date: new Date(c.created_at) }); });
    
    combinedData.sort(function(a, b) { return b.date - a.date; });

    var start = ipSearchPage * ADMIN_PAGE_SIZE;
    var end = start + ADMIN_PAGE_SIZE;
    var pageData = combinedData.slice(start, end);

    if (ipSearchPage === 0) container.innerHTML = '';
    
    if (combinedData.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400">해당 IP로 작성된 글이나 댓글이 없습니다.</div>';
        return;
    }

    if (ipSearchPage === 0) {
        var header = document.createElement('div');
        header.className = "mb-4 text-sm text-slate-500 font-bold";
        header.innerText = '총 ' + combinedData.length + '건 검색됨';
        container.appendChild(header);
    }

    pageData.forEach(function(item) {
        var isPost = item.type === 'post';
        var obj = item.data;
        var isDeleted = !!obj.deleted_at;
        var div = document.createElement('div');
        div.className = 'bg-white p-3 rounded-lg border ' + (isDeleted ? 'border-red-200 bg-red-50' : 'border-slate-200') + ' shadow-sm hover:bg-slate-50 cursor-pointer mb-2';
        
        if (isPost) {
            div.onclick = function() { readPost(obj.id); };
            div.innerHTML = '<div class="flex justify-between items-center"><div class="truncate mr-2"><span class="text-xs font-bold text-blue-600 mr-1">[' + obj.type + ']</span>' + (isDeleted ? '<span class="text-xs font-bold text-red-600 mr-1">[삭제됨]</span>' : '') + '<span class="text-sm font-medium text-slate-800">' + escapeHtml(obj.title) + '</span></div><div class="text-xs text-slate-400 whitespace-nowrap">' + item.date.toLocaleDateString() + '</div></div>';
        } else {
            div.onclick = function() { showContentModal(obj.content, "댓글 내용"); };
            var cleanContent = obj.content.replace(/<[^>]*>/g, ' ').substring(0, 40);
            div.innerHTML = '<div class="text-sm text-slate-700 mb-1 line-clamp-1">' + (isDeleted ? '<span class="text-xs font-bold text-red-600 mr-1">[삭제됨]</span>' : '') + '<i class="fa-regular fa-comment-dots mr-1 text-slate-400"></i>' + escapeHtml(cleanContent) + '...</div><div class="flex justify-between items-center text-xs text-slate-400"><span>작성자: ' + escapeHtml(obj.author) + '</span><span>' + item.date.toLocaleDateString() + '</span></div></div>';
        }
        container.appendChild(div);
    });

    if (combinedData.length > end) {
        var btn = document.createElement('button');
        btn.className = "w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition mt-2";
        btn.innerHTML = '더 보기 (' + (combinedData.length - end) + '개 남음)';
        btn.onclick = function() {
            ipSearchPage++;
            renderIpSearchResults();
        };
        container.appendChild(btn);
    }
}

function toggleSelectAll(type, checked) {
    var className = type === 'post' ? 'del-chk-post' : 'del-chk-comment';
    document.querySelectorAll('.' + className).forEach(function(cb) { cb.checked = checked; });
}

async function fetchReportedItems() {
    var dbClient = getDbClient();
    if(!dbClient) return;
    var container = document.getElementById('reported-posts-list'); 
    var containerC = document.getElementById('reported-comments-list');
    
    var postsRes = await dbClient.from('posts').select('*').gte('reports', 1).is('deleted_at', null).order('reports', {ascending:false});
    var cmtsRes = await dbClient.from('comments').select('*').gte('reports', 1).is('deleted_at', null).order('reports', {ascending:false});

    container.innerHTML = ''; 
    containerC.innerHTML = '';
    
    if(postsRes.data) {
        postsRes.data.forEach(function(item) {
            var div = document.createElement('div');
            div.className = "bg-white p-3 rounded-xl border border-red-200 bg-red-50 flex items-center justify-between mb-2 cursor-pointer hover:bg-red-100 transition";
            div.onclick = function(e) { if(e.target.tagName !== 'BUTTON') readPost(item.id); };
            
            div.innerHTML = '<div><span class="text-xs font-bold text-red-600 mr-2">신고 ' + item.reports + '회</span><span class="text-sm font-bold text-slate-700">' + escapeHtml(item.title) + '</span></div><div><button onclick="clearReports(\'post\', \'' + item.id + '\')" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 mr-2" onclick="event.stopPropagation()">초기화</button><button onclick="deletePostByAdmin(\'' + item.id + '\')" class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700" onclick="event.stopPropagation()">삭제</button></div>';
            container.appendChild(div);
        });
    }
    
    if(cmtsRes.data) {
        cmtsRes.data.forEach(function(item) {
            var div = document.createElement('div');
            div.className = "bg-white p-3 rounded-xl border border-red-200 bg-red-50 flex items-center justify-between mb-2 cursor-pointer hover:bg-red-100 transition";
            var content = item.content.replace(/<[^>]*>/g, '').substring(0,30);
            div.onclick = function(e) { if(e.target.tagName !== 'BUTTON') showContentModal(item.content, "신고된 댓글 내용"); };
            
            div.innerHTML = '<div><span class="text-xs font-bold text-red-600 mr-2">신고 ' + item.reports + '회</span><span class="text-sm font-bold text-slate-700">' + escapeHtml(content) + '</span></div><div><button onclick="clearReports(\'comment\', \'' + item.id + '\')" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 mr-2" onclick="event.stopPropagation()">초기화</button><button onclick="deleteCommentByAdmin(\'' + item.id + '\')" class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700" onclick="event.stopPropagation()">삭제</button></div>';
            containerC.appendChild(div);
        });
    }
    
    if(!postsRes.data || postsRes.data.length === 0) document.getElementById('no-reported-posts').classList.remove('hidden'); else document.getElementById('no-reported-posts').classList.add('hidden');
    if(!cmtsRes.data || cmtsRes.data.length === 0) document.getElementById('no-reported-comments').classList.remove('hidden'); else document.getElementById('no-reported-comments').classList.add('hidden');
}

async function clearReports(type, id) {
    var dbClient = getDbClient();
    showConfirm("신고 횟수를 초기화하시겠습니까?", async function() {
        var table = type === 'post' ? 'posts' : 'comments';
        var res = await dbClient.from(table).update({ reports: 0, reported_by: [] }).eq('id', id);
        
        if(res.error) showAlert("초기화 실패");
        else {
            showAlert("신고가 초기화되었습니다.");
            fetchReportedItems();
        }
    }, "신고 초기화", "초기화");
}

async function deletePostByAdmin(id) {
    event.stopPropagation();
    showConfirm("이 게시글을 삭제하시겠습니까? (휴지통으로 이동)", async function() {
        var dbClient = getDbClient();
        var res = await dbClient.from('posts').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', id);
        if(res.error) showAlert("삭제 실패: " + res.error.message);
        else {
            showAlert("게시글이 삭제되었습니다.");
            fetchReportedItems(); 
        }
    }, "게시글 삭제", "삭제");
}

async function deleteCommentByAdmin(id) {
    event.stopPropagation();
    showConfirm("이 댓글을 삭제하시겠습니까? (휴지통으로 이동)", async function() {
        var dbClient = getDbClient();
        var res = await dbClient.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        if(res.error) showAlert("삭제 실패: " + res.error.message);
        else {
            showAlert("댓글이 삭제되었습니다.");
            fetchReportedItems(); 
        }
    }, "댓글 삭제", "삭제");
}
