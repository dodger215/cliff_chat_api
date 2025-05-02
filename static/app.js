document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const authModal = document.getElementById('authModal');
    const authModalTitle = document.getElementById('authModalTitle');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const authTabs = document.getElementById('authTabs');
    const signupTab = document.getElementById('signupTab');
    const loginTab = document.getElementById('loginTab');
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const authMessage = document.getElementById('authMessage');
    const authButton = document.getElementById('authButton');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutButton = document.getElementById('logoutButton');
    const toggleDarkMode = document.getElementById('toggleDarkMode');
    
    const createGroupModal = document.getElementById('createGroupModal');
    const closeCreateGroupModal = document.getElementById('closeCreateGroupModal');
    const createGroupForm = document.getElementById('createGroupForm');
    const createGroupButton = document.getElementById('createGroupButton');
    const userList = document.getElementById('userList');
    
    const sidebar = document.getElementById('sidebar');
    const groupList = document.getElementById('groupList');
    const allUserList = document.getElementById('allUserList');
    
    const chatHeader = document.getElementById('chatHeader');
    const currentChatName = document.getElementById('currentChatName');
    const currentChatInfo = document.getElementById('currentChatInfo');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInputContainer = document.getElementById('messageInputContainer');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const emptyState = document.getElementById('emptyState');
    
  
    const mobileGroupsButton = document.getElementById('mobileGroupsButton');
    const mobileUsersButton = document.getElementById('mobileUsersButton');
    const mobileNewGroupButton = document.getElementById('mobileNewGroupButton');
    
    // App state
    let currentUser = null;
    let token = null;
    let currentChat = null;
    let socket = null;
    
    // Initialize the app
    init();
    
    function init() {
        // Check for saved token
        const savedToken = localStorage.getItem('chatToken');
        if (savedToken) {
            token = savedToken;
            fetchCurrentUser();
        }
        
        // Event listeners
        closeAuthModal.addEventListener('click', () => authModal.classList.add('hidden'));
        signupTab.addEventListener('click', () => switchAuthTab('signup'));
        loginTab.addEventListener('click', () => switchAuthTab('login'));
        authButton.addEventListener('click', () => {
            authModal.classList.remove('hidden');
            switchAuthTab('login');
        });
        logoutButton.addEventListener('click', logout);
        toggleDarkMode.addEventListener('click', toggleDarkModeHandler);
        
        signupForm.addEventListener('submit', handleSignup);
        loginForm.addEventListener('submit', handleLogin);
        
        createGroupButton.addEventListener('click', () => createGroupModal.classList.remove('hidden'));
        closeCreateGroupModal.addEventListener('click', () => createGroupModal.classList.add('hidden'));
        createGroupForm.addEventListener('submit', handleCreateGroup);
        
        messageForm.addEventListener('submit', handleSendMessage);
        
        // Mobile navigation
        mobileGroupsButton.addEventListener('click', () => {
            sidebar.classList.remove('hidden');
            updateMobileNav('groups');
            loadGroups();
        });
        
        mobileUsersButton.addEventListener('click', () => {
            sidebar.classList.remove('hidden');
            updateMobileNav('users');
            loadAllUsers();
        });
        
        mobileNewGroupButton.addEventListener('click', () => {
            createGroupModal.classList.remove('hidden');
            updateMobileNav('newGroup');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 768 && !sidebar.contains(e.target) && 
                e.target !== mobileGroupsButton && e.target !== mobileUsersButton && 
                e.target !== mobileNewGroupButton) {
                sidebar.classList.add('hidden');
            }
        });
    }
    
    function switchAuthTab(tab) {
        if (tab === 'signup') {
            signupTab.classList.add('text-primary', 'border-primary');
            signupTab.classList.remove('text-muted');
            loginTab.classList.add('text-muted');
            loginTab.classList.remove('text-primary', 'border-primary');
            signupForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            authModalTitle.textContent = 'Sign Up';
        } else {
            loginTab.classList.add('text-primary', 'border-primary');
            loginTab.classList.remove('text-muted');
            signupTab.classList.add('text-muted');
            signupTab.classList.remove('text-primary', 'border-primary');
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            authModalTitle.textContent = 'Login';
        }
        authMessage.classList.add('hidden');
    }
    
    async function handleSignup(e) {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const fullName = document.getElementById('signupFullName').value;
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        
        try {
            const response = await fetch('/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, full_name: fullName, username, password }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Signup failed');
            }
            
            const data = await response.json();
            showAuthMessage('Signup successful! Please login.', 'text-green-500');
            switchAuthTab('login');
            document.getElementById('loginUsername').value = username;
        } catch (error) {
            showAuthMessage(error.message, 'text-red-500');
        }
    }
    
    async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }
            
            const data = await response.json();
            token = data.access_token;
            localStorage.setItem('chatToken', token);
            authModal.classList.add('hidden');
            await fetchCurrentUser();
        } catch (error) {
            showAuthMessage(error.message, 'text-red-500');
        }
    }
    
    function showAuthMessage(message, colorClass) {
        authMessage.textContent = message;
        authMessage.className = `mt-4 text-sm ${colorClass}`;
        authMessage.classList.remove('hidden');
    }
    
    async function fetchCurrentUser() {
        try {
            const response = await fetch('/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }
            
            const users = await response.json();
            // The first user is the current user (simplification for demo)
            // In a real app, you'd have a /me endpoint
            currentUser = users[0];
            updateUIAfterLogin();
            initializeSocket();
            loadGroups();
            loadAllUsers();
        } catch (error) {
            console.error('Error fetching user:', error);
            logout();
        }
    }
    
    function updateUIAfterLogin() {
        authButton.classList.add('hidden');
        userInfo.classList.remove('hidden');
        usernameDisplay.textContent = currentUser.username;
        emptyState.classList.add('hidden');
    }
    
    function logout() {
        localStorage.removeItem('chatToken');
        token = null;
        currentUser = null;
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        authButton.classList.remove('hidden');
        userInfo.classList.add('hidden');
        groupList.innerHTML = '';
        allUserList.innerHTML = '';
        messagesContainer.innerHTML = '';
        chatHeader.classList.add('hidden');
        messageInputContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
    }
    
    function toggleDarkModeHandler() {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        } else {
            html.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
        }
    }
    
    function initializeSocket() {
        if (!token) return;
        
        socket = io({
            extraHeaders: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        socket.on('connect', () => {
            console.log('Connected to WebSocket');
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket');
        });
        
        socket.on('group_message', (data) => {
            if (currentChat && currentChat.id === data.group_id) {
                addMessageToChat(data);
            }
        });
        
        socket.on('error', (data) => {
            console.error('WebSocket error:', data.message);
        });
    }
    
    async function loadGroups() {
        try {
            const response = await fetch('/groups', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch groups');
            }
            
            const groups = await response.json();
            renderGroups(groups);
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }
    
    function renderGroups(groups) {
        groupList.innerHTML = '';
        
        if (groups.length === 0) {
            groupList.innerHTML = '<li class="text-muted text-sm">No groups yet. Create one!</li>';
            return;
        }
        
        groups.forEach(group => {
            const groupItem = document.createElement('li');
            groupItem.className = 'cursor-pointer hover:bg-bg-card p-2 rounded-md transition';
            groupItem.innerHTML = `
                <div class="font-medium">${group.name}</div>
                <div class="text-xs text-muted">Created ${new Date(group.created_at).toLocaleDateString()}</div>
            `;
            
            groupItem.addEventListener('click', () => {
                openGroupChat(group);
                if (window.innerWidth < 768) {
                    sidebar.classList.add('hidden');
                }
            });
            
            groupList.appendChild(groupItem);
        });
    }
    
    async function loadAllUsers() {
        try {
            const response = await fetch('/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            
            const users = await response.json();
            renderAllUsers(users);
            
            // Also populate the user list for creating groups
            renderUserListForGroupCreation(users);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    function renderAllUsers(users) {
        allUserList.innerHTML = '';
        
        users.forEach(user => {
            if (user.id === currentUser.id) return;
            
            const userItem = document.createElement('li');
            userItem.className = 'cursor-pointer hover:bg-bg-card p-2 rounded-md transition flex items-center';
            userItem.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-xs font-bold mr-2">${user.username.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="font-medium">${user.username}</div>
                    <div class="text-xs text-muted">${user.full_name}</div>
                </div>
            `;
            
            userItem.addEventListener('click', () => {
                openUserChat(user);
                if (window.innerWidth < 768) {
                    sidebar.classList.add('hidden');
                }
            });
            
            allUserList.appendChild(userItem);
        });
    }
    
    function renderUserListForGroupCreation(users) {
        userList.innerHTML = '';
        
        users.forEach(user => {
            if (user.id === currentUser.id) return;
            
            const userItem = document.createElement('div');
            userItem.className = 'flex items-center justify-between p-2 hover:bg-bg-card rounded-md';
            userItem.innerHTML = `
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-xs font-bold mr-2">${user.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="font-medium">${user.username}</div>
                        <div class="text-xs text-muted">${user.full_name}</div>
                    </div>
                </div>
                <input type="checkbox" class="user-checkbox" value="${user.id}" data-username="${user.username}">
            `;
            
            userList.appendChild(userItem);
        });
    }
    
    async function handleCreateGroup(e) {
        e.preventDefault();
        const groupName = document.getElementById('groupName').value;
        const checkboxes = document.querySelectorAll('.user-checkbox:checked');
        const userIds = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value));
        
        if (!groupName || userIds.length === 0) {
            alert('Please provide a group name and select at least one member');
            return;
        }
        
        try {
            const response = await fetch('/groups', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: groupName,
                    user_ids: userIds,
                }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create group');
            }
            
            const group = await response.json();
            createGroupModal.classList.add('hidden');
            loadGroups();
            openGroupChat(group);
        } catch (error) {
            console.error('Error creating group:', error);
            alert(error.message);
        }
    }
    
    function openGroupChat(group) {
        currentChat = {
            type: 'group',
            id: group.id,
            name: group.name,
        };
        
        chatHeader.classList.remove('hidden');
        currentChatName.textContent = group.name;
        currentChatInfo.textContent = 'Group chat';
        messageInputContainer.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        // Clear messages
        messagesContainer.innerHTML = '';
        
        // Join the group room via WebSocket
        if (socket) {
            socket.emit('join_group', {
                token: token,
                group_id: group.id,
            });
        }
        
        // Load group messages
        loadGroupMessages(group.id);
    }
    
    function openUserChat(user) {
        currentChat = {
            type: 'user',
            id: user.id,
            name: user.username,
        };
        
        chatHeader.classList.remove('hidden');
        currentChatName.textContent = user.username;
        currentChatInfo.textContent = user.full_name;
        messageInputContainer.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        // Clear messages
        messagesContainer.innerHTML = '';
        
        // For direct messages, we might need to implement a different WebSocket handler
        // For now, we'll just show the UI
    }
    
    async function loadGroupMessages(groupId) {
        try {
            const response = await fetch(`/groups/${groupId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }
            
            const messages = await response.json();
            renderMessages(messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    function renderMessages(messages) {
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="text-center text-muted py-4">No messages yet. Start the conversation!</div>';
            return;
        }
        
        messages.forEach(message => {
            addMessageToChat(message);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function addMessageToChat(message) {
        const isCurrentUser = message.sender_id === currentUser.id;
        
        const messageElement = document.createElement('div');
        messageElement.className = `flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`;
        
        messageElement.innerHTML = `
            <div class="max-w-xs md:max-w-md lg:max-w-lg rounded-lg p-3 ${isCurrentUser ? 'bg-primary text-white' : 'bg-card border border-main'}">
                ${!isCurrentUser ? `<div class="font-bold text-xs mb-1">${message.sender_username || 'Unknown'}</div>` : ''}
                <div>${message.content}</div>
                <div class="text-xs mt-1 ${isCurrentUser ? 'text-white text-opacity-80' : 'text-muted'}">
                    ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    async function handleSendMessage(e) {
        e.preventDefault();
        const message = messageInput.value.trim();
        
        if (!message || !currentChat) return;
        
        if (currentChat.type === 'group') {
            // Send group message via WebSocket
            if (socket) {
                socket.emit('group_message', {
                    token: token,
                    group_id: currentChat.id,
                    content: message,
                });
                
                // Optimistically add the message to the UI
                addMessageToChat({
                    sender_id: currentUser.id,
                    sender_username: currentUser.username,
                    content: message,
                    timestamp: new Date().toISOString(),
                    group_id: currentChat.id,
                });
                
                messageInput.value = '';
            }
        } else if (currentChat.type === 'user') {
            // For direct messages, we would need to implement a different endpoint
            // For now, we'll just show the message in the UI
            addMessageToChat({
                sender_id: currentUser.id,
                sender_username: currentUser.username,
                content: message,
                timestamp: new Date().toISOString(),
                receiver_id: currentChat.id,
            });
            
            messageInput.value = '';
        }
    }
    
    function updateMobileNav(activeTab) {
        // Reset all buttons
        mobileGroupsButton.classList.remove('text-primary');
        mobileGroupsButton.classList.add('text-muted');
        mobileUsersButton.classList.remove('text-primary');
        mobileUsersButton.classList.add('text-muted');
        mobileNewGroupButton.classList.remove('text-primary');
        mobileNewGroupButton.classList.add('text-muted');
        
        // Set active button
        if (activeTab === 'groups') {
            mobileGroupsButton.classList.remove('text-muted');
            mobileGroupsButton.classList.add('text-primary');
        } else if (activeTab === 'users') {
            mobileUsersButton.classList.remove('text-muted');
            mobileUsersButton.classList.add('text-primary');
        } else if (activeTab === 'newGroup') {
            mobileNewGroupButton.classList.remove('text-muted');
            mobileNewGroupButton.classList.add('text-primary');
        }
    }
    
    // Check for saved dark mode preference
    if (localStorage.getItem('darkMode') === 'true' || 
        (localStorage.getItem('darkMode') !== 'false' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
});