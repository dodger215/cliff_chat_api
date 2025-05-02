document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const themeToggle = document.getElementById('theme-toggle');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const createGroupBtn = document.getElementById('create-group-btn');
    const createGroupModal = document.getElementById('create-group-modal');
    const cancelGroupBtn = document.getElementById('cancel-group-btn');
    const confirmGroupBtn = document.getElementById('confirm-group-btn');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messageContainer = document.getElementById('message-container');
    const messageInputContainer = document.getElementById('message-input-container');
    const chatHeader = document.getElementById('chat-header');
    const userList = document.getElementById('user-list');
    const groupList = document.getElementById('group-list');
    const userCount = document.getElementById('user-count');
    const groupMemberSelect = document.getElementById('group-member-select');
    
    // State
    let currentUser = null;
    let currentChat = null;
    let currentChatType = null; // 'user' or 'group'
    let authToken = null;
    
    // Initialize
    checkAuth();
    setupEventListeners();


    // Add this function to check authentication status
async function checkAuth() {
    const token = getCookie('authToken');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const response = await fetch('/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            window.location.href = '/login';
        } else {
            currentUser = await response.json();
            authToken = token;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
    }
}

// Helper function to get cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
    
    // function checkAuth() {
    //     const token = localStorage.getItem('authToken');
    //     if (token) {
    //         authToken = token;
    //         fetchCurrentUser();
    //         loadUsers();
    //         loadGroups();
    //     } else {
    //         window.location.href = '/login.html';
    //     }
    // }
    
    function setupEventListeners() {
        // Theme toggle
        themeToggle.addEventListener('click', toggleTheme);
        
        // Mobile menu
        mobileMenuButton.addEventListener('click', toggleMobileMenu);
        if (mobileSidebar) {
            mobileSidebar.querySelector('div:first-child').addEventListener('click', toggleMobileMenu);
        }
        
        // Group creation
        if (createGroupBtn) createGroupBtn.addEventListener('click', showCreateGroupModal);
        if (cancelGroupBtn) cancelGroupBtn.addEventListener('click', hideCreateGroupModal);
        if (confirmGroupBtn) confirmGroupBtn.addEventListener('click', createGroup);
        
        // Messaging
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);
        if (messageInput) messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
        
        // Socket.IO events
        socketio.on('connect', () => {
            console.log('Connected to WebSocket server');
        });
        
        socketio.on('group_message', (data) => {
            if (currentChatType === 'group' && currentChat === data.group_id) {
                addMessageToChat(data, false);
            }
        });
    }
    
    // Auth functions
    async function fetchCurrentUser() {
        try {
            const response = await fetch('/users/me', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                currentUser = await response.json();
            } else {
                localStorage.removeItem('authToken');
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Error fetching current user:', error);
        }
    }
    
    // Data loading functions
    async function loadUsers() {
        try {
            const response = await fetch('/users', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const users = await response.json();
                renderUserList(users);
                
                // Also load for group creation
                renderGroupMemberSelect(users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    async function loadGroups() {
        try {
            const response = await fetch('/groups', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const groups = await response.json();
                renderGroupList(groups);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }
    
    async function loadMessages(chatId, type) {
        try {
            const endpoint = type === 'group' ? `/groups/${chatId}/messages` : `/chat/${chatId}`;
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const messages = await response.json();
                renderMessages(messages, type);
                messageInputContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    // Rendering functions
    function renderUserList(users) {
        userList.innerHTML = '';
        userCount.textContent = users.length;
        
        users.forEach(user => {
            if (user.id === currentUser.id) return;
            
            const userElement = document.createElement('div');
            userElement.className = 'flex items-center p-3 hover:bg-card rounded-lg cursor-pointer transition';
            userElement.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold mr-3">
                    ${user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p class="font-medium">${user.username}</p>
                    <p class="text-sm text-muted">${user.full_name}</p>
                </div>
            `;
            
            userElement.addEventListener('click', () => {
                currentChat = user.id;
                currentChatType = 'user';
                chatHeader.innerHTML = `<h2 class="text-xl font-semibold">${user.username}</h2>`;
                loadMessages(user.id, 'user');
            });
            
            userList.appendChild(userElement);
        });
    }
    
    function renderGroupList(groups) {
        groupList.innerHTML = '';
        
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'flex items-center p-3 hover:bg-bg-card rounded-lg cursor-pointer transition';
            groupElement.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-primary mr-3"></span>
                <div>
                    <p class="font-medium">${group.name}</p>
                    <p class="text-sm text-muted">${new Date(group.created_at).toLocaleDateString()}</p>
                </div>
            `;
            
            groupElement.addEventListener('click', () => {
                currentChat = group.id;
                currentChatType = 'group';
                chatHeader.innerHTML = `<h2 class="text-xl font-semibold">${group.name}</h2>`;
                loadMessages(group.id, 'group');
                joinGroupChat(group.id);
            });
            
            groupList.appendChild(groupElement);
        });
    }
    
    function renderMessages(messages, type) {
        messageContainer.innerHTML = '';
        
        if (messages.length === 0) {
            messageContainer.innerHTML = '<div class="text-center text-muted py-10">No messages yet</div>';
            return;
        }
        
        messages.forEach(message => {
            const isMe = message.sender_id === currentUser.id;
            const senderName = type === 'group' && !isMe ? message.sender_username : null;
            
            const messageElement = document.createElement('div');
            messageElement.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
            
            messageElement.innerHTML = `
                <div class="max-w-xs md:max-w-md rounded-lg p-3 ${isMe ? 'bg-primary text-white' : 'bg-card'}">
                    ${senderName ? `<p class="font-semibold ${isMe ? 'text-white' : 'text-primary'}">${senderName}</p>` : ''}
                    <p>${message.content}</p>
                    <p class="text-xs ${isMe ? 'text-primary-light' : 'text-muted'} mt-1">
                        ${new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                </div>
            `;
            
            messageContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    function renderGroupMemberSelect(users) {
        groupMemberSelect.innerHTML = '';
        
        users.forEach(user => {
            if (user.id === currentUser.id) return;
            
            const userElement = document.createElement('div');
            userElement.className = 'flex items-center p-2 hover:bg-bg-card rounded transition';
            userElement.innerHTML = `
                <input type="checkbox" id="user-${user.id}" value="${user.id}" class="mr-2">
                <label for="user-${user.id}" class="flex items-center cursor-pointer">
                    <div class="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold mr-2">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <span>${user.username}</span>
                </label>
            `;
            
            groupMemberSelect.appendChild(userElement);
        });
    }
    
    // Chat functions
    function sendMessage() {
        const content = messageInput.value.trim();
        if (!content || !currentChat || !currentChatType) return;
        
        if (currentChatType === 'group') {
            socketio.emit('group_message', {
                token: authToken,
                group_id: currentChat,
                content: content
            });
        } else {
            // For 1:1 chat (you'll need to implement this endpoint)
            fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    receiver_id: currentChat,
                    content: content
                })
            });
        }
        
        // Add message optimistically
        const tempMessage = {
            sender_id: currentUser.id,
            content: content,
            timestamp: new Date().toISOString()
        };
        
        addMessageToChat(tempMessage, true);
        messageInput.value = '';
    }
    
    function addMessageToChat(message, isMe) {
        const messageElement = document.createElement('div');
        messageElement.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
        
        messageElement.innerHTML = `
            <div class="max-w-xs md:max-w-md rounded-lg p-3 ${isMe ? 'bg-primary text-white' : 'bg-card'}">
                ${!isMe && currentChatType === 'group' ? `<p class="font-semibold ${isMe ? 'text-white' : 'text-primary'}">${message.sender_username || 'User'}</p>` : ''}
                <p>${message.content}</p>
                <p class="text-xs ${isMe ? 'text-primary-light' : 'text-muted'} mt-1">
                    ${new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
            </div>
        `;
        
        messageContainer.appendChild(messageElement);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    function joinGroupChat(groupId) {
        socketio.emit('join_group', {
            token: authToken,
            group_id: groupId
        });
    }
    
    // Group creation functions
    function showCreateGroupModal() {
        createGroupModal.classList.remove('hidden');
    }
    
    function hideCreateGroupModal() {
        createGroupModal.classList.add('hidden');
    }
    
    async function createGroup() {
        const groupName = document.getElementById('group-name').value.trim();
        if (!groupName) return;
        
        const selectedUsers = Array.from(groupMemberSelect.querySelectorAll('input:checked')).map(el => parseInt(el.value));
        if (selectedUsers.length === 0) return;
        
        try {
            const response = await fetch('/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    name: groupName,
                    user_ids: selectedUsers
                })
            });
            
            if (response.ok) {
                const group = await response.json();
                loadGroups(); // Refresh group list
                hideCreateGroupModal();
                
                // Clear form
                document.getElementById('group-name').value = '';
                groupMemberSelect.querySelectorAll('input').forEach(input => {
                    input.checked = false;
                });
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to create group');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Failed to create group');
        }
    }
    
    // UI functions
    function toggleMobileMenu() {
        mobileSidebar.classList.toggle('hidden');
        const menu = mobileSidebar.querySelector('div:last-child');
        if (mobileSidebar.classList.contains('hidden')) {
            menu.classList.remove('translate-x-0');
            menu.classList.add('-translate-x-full');
        } else {
            menu.classList.remove('-translate-x-full');
            menu.classList.add('translate-x-0');
        }
    }
    
    function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
    
    // Initialize theme
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark');
        }
    }
    
    initTheme();
});