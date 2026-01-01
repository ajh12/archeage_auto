var isLikeProcessing = false;

async function initLikeButton(postId) {
    var btn = document.getElementById('btn-like');
    var icon = document.getElementById('like-icon');
    var countSpan = document.getElementById('like-count');
    
    if (!btn || !icon || !postId) return;

    icon.className = 'fa-solid fa-heart text-2xl text-slate-300 group-hover:text-red-500 transition-colors duration-300';
    btn.classList.remove('border-red-200', 'shadow-red-100', 'shadow-lg');
    
 

    try {
        var db = getDbClient();
        if (!db) return;

        var ipPromise = fetchClientIP();
        
        var postPromise = db
            .from('posts')
            .select('likes')
            .eq('id', postId)
            .single();

        var ip = await ipPromise;
        var likeCheckPromise = null;
        
        if (ip) {
            likeCheckPromise = db
                .from('post_likes')
                .select('id')
                .eq('post_id', postId)
                .eq('ip', ip)
                .maybeSingle();
        }

        var [postResult, likeCheckResult] = await Promise.all([
            postPromise, 
            likeCheckPromise || Promise.resolve({ data: null })
        ]);

        if (postResult.data) {
            countSpan.innerText = postResult.data.likes || 0;
        }

        if (likeCheckResult && likeCheckResult.data) {
            icon.classList.remove('text-slate-300', 'group-hover:text-red-500');
            icon.classList.add('text-red-500');
            btn.classList.add('border-red-200', 'shadow-red-100');
        }

    } catch (e) {
        console.error("좋아요 초기화 실패:", e);
        countSpan.innerText = '0';
    }
}

async function toggleLike() {
    if (isLikeProcessing) return;
    
    var postId = window.currentPostId;
    if (!postId) return;
    
    isLikeProcessing = true;
    var btn = document.getElementById('btn-like');
    var icon = document.getElementById('like-icon');
    var countSpan = document.getElementById('like-count');
    
    try {
        var ip = await fetchClientIP();
        var db = getDbClient();
        
        if (!db || !ip) {
            if(typeof showAlert === 'function') showAlert("시스템 오류: DB 연결 불가");
            isLikeProcessing = false;
            return;
        }

        var rpcResult = await db.rpc('toggle_like', { 
            p_post_id: postId, 
            p_ip: ip 
        });

        if (rpcResult.error) {
            console.error(rpcResult.error);
            if(typeof showAlert === 'function') showAlert("오류가 발생했습니다.");
            isLikeProcessing = false;
            return;
        }

        var data = rpcResult.data;
        
        countSpan.innerText = data.count;
        
        if (data.action === 'liked') {
            icon.classList.remove('text-slate-300', 'group-hover:text-red-500');
            icon.classList.add('text-red-500');
            
            icon.classList.add('fa-beat');
            setTimeout(function() { icon.classList.remove('fa-beat'); }, 1000);
            
            btn.classList.add('border-red-200', 'shadow-red-100');
        } else {
            icon.classList.remove('text-red-500', 'fa-beat');
            icon.classList.add('text-slate-300', 'group-hover:text-red-500');
            
            btn.classList.remove('border-red-200', 'shadow-red-100');
        }

    } catch (e) {
        console.error(e);
        if(typeof showAlert === 'function') showAlert("처리 중 오류가 발생했습니다.");
    } finally {
        isLikeProcessing = false;
    }
}
