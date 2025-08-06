class GameAccountManager {
    constructor() {
        this.data = this.loadData();
        this.currentGame = null;
        this.currentAccount = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStats();
        this.renderGames();
        this.applyTheme();
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Import/Export
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        document.getElementById('importData').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
        
        // Navigation
        document.getElementById('addGameBtn').addEventListener('click', () => this.showGameModal());
        document.getElementById('backToGames').addEventListener('click', () => this.showGamesView());
        document.getElementById('addAccountBtn').addEventListener('click', () => this.showAccountModal());
        
        // Search and filters
        document.getElementById('searchGames').addEventListener('input', (e) => this.filterGames(e.target.value));
        document.getElementById('statusFilter').addEventListener('change', () => this.filterAccounts());
        document.getElementById('dateFilter').addEventListener('change', () => this.filterAccounts());
        document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());
        
        // Modal handlers
        this.setupModalHandlers();
        
        // Form submissions
        document.getElementById('gameForm').addEventListener('submit', (e) => this.handleGameSubmit(e));
        document.getElementById('accountForm').addEventListener('submit', (e) => this.handleAccountSubmit(e));
        
        // Image upload
        this.setupImageUpload();
    }

    setupModalHandlers() {
        const modals = ['gameModal', 'accountModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const closeButtons = modal.querySelectorAll('.modal-close');
            
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => this.closeModal(modalId));
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modalId);
                }
            });
        });
    }

    setupImageUpload() {
        const uploadArea = document.getElementById('imageUpload');
        const fileInput = document.getElementById('gameImageInput');
        const preview = document.getElementById('imagePreview');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--border-color)';
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files[0]) this.handleImageFile(files[0]);
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this.handleImageFile(e.target.files[0]);
        });
    }

    handleImageFile(file) {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('imagePreview');
            const placeholder = document.querySelector('.upload-placeholder');
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    loadData() {
        const saved = localStorage.getItem('gameAccountData');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            games: [],
            settings: {
                theme: 'light',
                currency: 'IDR'
            }
        };
    }

    saveData() {
        localStorage.setItem('gameAccountData', JSON.stringify(this.data));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    updateStats() {
        let totalInvested = 0;
        let totalProfit = 0;
        let totalAccounts = 0;
        let availableAccounts = 0;

        this.data.games.forEach(game => {
            game.accounts.forEach(account => {
                totalInvested += account.buyPrice || 0;
                if (account.status === 'sold' && account.sellPrice) {
                    totalProfit += (account.sellPrice - account.buyPrice);
                }
                totalAccounts++;
                if (account.status === 'available') {
                    availableAccounts++;
                }
            });
        });

        document.getElementById('totalInvested').textContent = this.formatCurrency(totalInvested);
       document.getElementById('totalProfit').textContent = this.formatCurrency(totalProfit);
       document.getElementById('totalAccounts').textContent = totalAccounts;
       document.getElementById('availableAccounts').textContent = availableAccounts;
   }

   renderGames(filter = '') {
       const grid = document.getElementById('gamesGrid');
       const filteredGames = this.data.games.filter(game => 
           game.name.toLowerCase().includes(filter.toLowerCase())
       );

       if (filteredGames.length === 0) {
           grid.innerHTML = `
               <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                   <i class="fas fa-gamepad" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                   <p>No games found. Add your first game to get started!</p>
               </div>
           `;
           return;
       }

       grid.innerHTML = filteredGames.map(game => {
           const stats = this.getGameStats(game);
           return `
               <div class="game-card" onclick="gameManager.showGameDetail('${game.id}')">
                   <div class="game-image">
                       ${game.image ? 
                           `<img src="${game.image}" alt="${game.name}">` : 
                           `<i class="fas fa-gamepad"></i>`
                       }
                   </div>
                   <div class="game-info">
                       <h3>${game.name}</h3>
                       <div class="game-stats">
                           <div class="game-stat">
                               <div class="number">${stats.totalAccounts}</div>
                               <div class="label">Accounts</div>
                           </div>
                           <div class="game-stat">
                               <div class="number">${stats.available}</div>
                               <div class="label">Available</div>
                           </div>
                           <div class="game-stat">
                               <div class="number" style="color: var(--success-color);">${this.formatCurrency(stats.profit)}</div>
                               <div class="label">Profit</div>
                           </div>
                       </div>
                   </div>
               </div>
           `;
       }).join('');
   }

   getGameStats(game) {
       let totalAccounts = game.accounts.length;
       let available = game.accounts.filter(acc => acc.status === 'available').length;
       let profit = game.accounts
           .filter(acc => acc.status === 'sold')
           .reduce((sum, acc) => sum + ((acc.sellPrice || 0) - (acc.buyPrice || 0)), 0);
       
       return { totalAccounts, available, profit };
   }

   showGameDetail(gameId) {
       this.currentGame = this.data.games.find(game => game.id === gameId);
       if (!this.currentGame) return;

       document.getElementById('gameDetailTitle').textContent = this.currentGame.name + ' Accounts';
       document.getElementById('gamesView').classList.remove('active');
       document.getElementById('gameDetailView').classList.add('active');
       
       this.renderAccounts();
   }

   showGamesView() {
       document.getElementById('gameDetailView').classList.remove('active');
       document.getElementById('gamesView').classList.add('active');
       this.currentGame = null;
   }

   renderAccounts(accounts = null) {
       if (!this.currentGame) return;
       
       const accountsToRender = accounts || this.currentGame.accounts;
       const tableContainer = document.getElementById('accountsTable');
       
       if (accountsToRender.length === 0) {
           tableContainer.innerHTML = `
               <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                   <i class="fas fa-user-plus" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                   <p>No accounts found. Add your first account!</p>
               </div>
           `;
           return;
       }

       tableContainer.innerHTML = `
           <table>
               <thead>
                   <tr>
                       <th>Email</th>
                       <th>Password</th>
                       <th>Buy Price</th>
                       <th>Sell Price</th>
                       <th>Profit</th>
                       <th>Status</th>
                       <th>Date Bought</th>
                       <th>Notes</th>
                       <th>Actions</th>
                   </tr>
               </thead>
               <tbody>
                   ${accountsToRender.map(account => this.renderAccountRow(account)).join('')}
               </tbody>
           </table>
       `;
   }

   renderAccountRow(account) {
       const profit = (account.sellPrice || 0) - (account.buyPrice || 0);
       const profitClass = profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : 'profit-neutral';
       
       return `
           <tr>
               <td>${account.email}</td>
               <td>
                   <span class="password-field" data-password="${account.password}">
                       ${'•'.repeat(8)}
                       <button onclick="gameManager.togglePassword(this)" class="btn-icon" style="padding: 0.25rem; margin-left: 0.5rem;">
                           <i class="fas fa-eye"></i>
                       </button>
                   </span>
               </td>
               <td>${this.formatCurrency(account.buyPrice || 0)}</td>
               <td>${account.sellPrice ? this.formatCurrency(account.sellPrice) : '-'}</td>
               <td class="${profitClass}">${account.status === 'sold' ? this.formatCurrency(profit) : '-'}</td>
               <td><span class="status-badge status-${account.status}">${account.status}</span></td>
               <td>${this.formatDate(account.dateBought)}</td>
               <td>${account.notes || '-'}</td>
               <td>
                   <button onclick="gameManager.editAccount('${account.id}')" class="btn-icon" title="Edit">
                       <i class="fas fa-edit"></i>
                   </button>
                   <button onclick="gameManager.deleteAccount('${account.id}')" class="btn-icon" title="Delete" style="color: var(--danger-color);">
                       <i class="fas fa-trash"></i>
                   </button>
               </td>
           </tr>
       `;
   }

   togglePassword(button) {
       const passwordField = button.parentElement;
       const passwordData = passwordField.dataset.password;
       const isHidden = passwordField.textContent.includes('•');
       
       if (isHidden) {
           passwordField.innerHTML = `
               ${passwordData}
               <button onclick="gameManager.togglePassword(this)" class="btn-icon" style="padding: 0.25rem; margin-left: 0.5rem;">
                   <i class="fas fa-eye-slash"></i>
               </button>
           `;
       } else {
           passwordField.innerHTML = `
               ${'•'.repeat(8)}
               <button onclick="gameManager.togglePassword(this)" class="btn-icon" style="padding: 0.25rem; margin-left: 0.5rem;">
                   <i class="fas fa-eye"></i>
               </button>
           `;
       }
   }

   filterGames(searchTerm) {
       this.renderGames(searchTerm);
   }

   filterAccounts() {
       if (!this.currentGame) return;
       
       const statusFilter = document.getElementById('statusFilter').value;
       const dateFilter = document.getElementById('dateFilter').value;
       
       let filtered = this.currentGame.accounts;
       
       if (statusFilter) {
           filtered = filtered.filter(account => account.status === statusFilter);
       }
       
       if (dateFilter) {
           filtered = filtered.filter(account => account.dateBought === dateFilter);
       }
       
       this.renderAccounts(filtered);
   }

   clearFilters() {
       document.getElementById('statusFilter').value = '';
       document.getElementById('dateFilter').value = '';
       this.renderAccounts();
   }

   showGameModal(gameId = null) {
       const modal = document.getElementById('gameModal');
       const title = document.getElementById('gameModalTitle');
       const form = document.getElementById('gameForm');
       
       if (gameId) {
           const game = this.data.games.find(g => g.id === gameId);
           title.textContent = 'Edit Game';
           document.getElementById('gameName').value = game.name;
           if (game.image) {
               document.getElementById('imagePreview').src = game.image;
               document.getElementById('imagePreview').style.display = 'block';
               document.querySelector('.upload-placeholder').style.display = 'none';
           }
       } else {
           title.textContent = 'Add New Game';
           form.reset();
           document.getElementById('imagePreview').style.display = 'none';
           document.querySelector('.upload-placeholder').style.display = 'block';
       }
       
       this.currentGame = gameId;
       modal.classList.add('active');
   }

   showAccountModal(accountId = null) {
       const modal = document.getElementById('accountModal');
       const title = document.getElementById('accountModalTitle');
       const form = document.getElementById('accountForm');
       
       if (accountId) {
           const account = this.currentGame.accounts.find(a => a.id === accountId);
           title.textContent = 'Edit Account';
           document.getElementById('accountEmail').value = account.email;
           document.getElementById('accountPassword').value = account.password;
           document.getElementById('buyPrice').value = account.buyPrice;
           document.getElementById('sellPrice').value = account.sellPrice || '';
           document.getElementById('dateBought').value = account.dateBought;
           document.getElementById('accountStatus').value = account.status;
           document.getElementById('accountNotes').value = account.notes || '';
       } else {
           title.textContent = 'Add New Account';
           form.reset();
           document.getElementById('dateBought').value = new Date().toISOString().split('T')[0];
           document.getElementById('accountStatus').value = 'available';
       }
       
       this.currentAccount = accountId;
       modal.classList.add('active');
   }

   closeModal(modalId) {
       document.getElementById(modalId).classList.remove('active');
   }

   handleGameSubmit(e) {
       e.preventDefault();
       
       const name = document.getElementById('gameName').value;
       const imagePreview = document.getElementById('imagePreview');
       const image = imagePreview.style.display === 'block' ? imagePreview.src : null;
       
       if (this.currentGame && typeof this.currentGame === 'string') {
           // Edit existing game
           const game = this.data.games.find(g => g.id === this.currentGame);
           game.name = name;
           if (image) game.image = image;
       } else {
           // Add new game
           const newGame = {
               id: this.generateId(),
               name,
               image,
               accounts: []
           };
           this.data.games.push(newGame);
       }
       
       this.saveData();
       this.updateStats();
       this.renderGames();
       this.closeModal('gameModal');
       this.currentGame = null;
   }

   handleAccountSubmit(e) {
       e.preventDefault();
       
       const accountData = {
           email: document.getElementById('accountEmail').value,
           password: document.getElementById('accountPassword').value,
           buyPrice: parseInt(document.getElementById('buyPrice').value),
           sellPrice: document.getElementById('sellPrice').value ? 
                      parseInt(document.getElementById('sellPrice').value) : null,
           dateBought: document.getElementById('dateBought').value,
           status: document.getElementById('accountStatus').value,
           notes: document.getElementById('accountNotes').value,
           created: new Date().toISOString()
       };
       
       if (this.currentAccount) {
           // Edit existing account
           const accountIndex = this.currentGame.accounts.findIndex(a => a.id === this.currentAccount);
           this.currentGame.accounts[accountIndex] = { ...accountData, id: this.currentAccount };
       } else {
           // Add new account
           accountData.id = this.generateId();
           this.currentGame.accounts.push(accountData);
       }
       
       this.saveData();
       this.updateStats();
       this.renderAccounts();
       this.closeModal('accountModal');
       this.currentAccount = null;
   }

   editAccount(accountId) {
       this.showAccountModal(accountId);
   }

   deleteAccount(accountId) {
       if (confirm('Are you sure you want to delete this account?')) {
           this.currentGame.accounts = this.currentGame.accounts.filter(a => a.id !== accountId);
           this.saveData();
           this.updateStats();
           this.renderAccounts();
       }
   }

   toggleTheme() {
       const currentTheme = this.data.settings.theme;
       const newTheme = currentTheme === 'light' ? 'dark' : 'light';
       this.data.settings.theme = newTheme;
       this.saveData();
       this.applyTheme();
   }

   applyTheme() {
       document.documentElement.setAttribute('data-theme', this.data.settings.theme);
       const themeIcon = document.querySelector('#themeToggle i');
       themeIcon.className = this.data.settings.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
   }

   exportData() {
       const dataStr = JSON.stringify(this.data, null, 2);
       const dataBlob = new Blob([dataStr], {type: 'application/json'});
       const url = URL.createObjectURL(dataBlob);
       const link = document.createElement('a');
       link.href = url;
       link.download = `game-accounts-backup-${new Date().toISOString().split('T')[0]}.json`;
       link.click();
       URL.revokeObjectURL(url);
   }

   importData(e) {
       const file = e.target.files[0];
       if (!file) return;
       
       const reader = new FileReader();
       reader.onload = (e) => {
           try {
               const importedData = JSON.parse(e.target.result);
               if (confirm('This will replace all current data. Continue?')) {
                   this.data = importedData;
                   this.saveData();
                   this.updateStats();
                   this.renderGames();
                   this.applyTheme();
                   alert('Data imported successfully!');
               }
           } catch (error) {
               alert('Invalid file format!');
           }
       };
       reader.readAsText(file);
       e.target.value = '';
   }
}

// Initialize the app
const gameManager = new GameAccountManager();