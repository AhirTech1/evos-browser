/**
 * EVOS User Profile Manager
 * Manages multiple user profiles with isolated data
 */

class ProfileManager {
    constructor() {
        this.profiles = [];
        this.activeProfileId = null;
        this.defaultProfile = {
            id: 'default',
            name: 'Default User',
            avatar: '👤',
            createdAt: Date.now(),
            personal: {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                dateOfBirth: '',
                address: {
                    street: '',
                    city: '',
                    state: '',
                    zip: '',
                    country: ''
                }
            },
            professional: {
                title: '',
                company: '',
                experience: '',
                skills: [],
                summary: '',
                linkedin: '',
                github: '',
                website: ''
            },
            customFields: {}
        };

        this.init();
    }

    async init() {
        await this.loadProfiles();
        this.renderProfileButton();
        console.log('[ProfileManager] Initialized with', this.profiles.length, 'profiles');
    }

    /**
     * Load profiles from storage
     */
    async loadProfiles() {
        try {
            const saved = localStorage.getItem('evos-profiles');
            if (saved) {
                const data = JSON.parse(saved);
                this.profiles = data.profiles || [];
                this.activeProfileId = data.activeProfileId || null;
            }

            // Create default profile if none exist
            if (this.profiles.length === 0) {
                this.profiles.push({ ...this.defaultProfile });
                this.activeProfileId = 'default';
                this.saveProfiles();
            }

            if (!this.activeProfileId && this.profiles.length > 0) {
                this.activeProfileId = this.profiles[0].id;
            }
        } catch (e) {
            console.error('[ProfileManager] Failed to load profiles:', e);
            this.profiles = [{ ...this.defaultProfile }];
            this.activeProfileId = 'default';
        }
    }

    /**
     * Save profiles to storage
     */
    saveProfiles() {
        try {
            localStorage.setItem('evos-profiles', JSON.stringify({
                profiles: this.profiles,
                activeProfileId: this.activeProfileId
            }));
        } catch (e) {
            console.error('[ProfileManager] Failed to save profiles:', e);
        }
    }

    /**
     * Get the active profile
     */
    getActiveProfile() {
        return this.profiles.find(p => p.id === this.activeProfileId) || this.profiles[0];
    }

    /**
     * Create a new profile
     */
    createProfile(name, avatar = '👤') {
        const profile = {
            ...JSON.parse(JSON.stringify(this.defaultProfile)),
            id: `profile-${Date.now()}`,
            name: name,
            avatar: avatar,
            createdAt: Date.now()
        };

        this.profiles.push(profile);
        this.saveProfiles();
        this.renderProfileButton();

        return profile;
    }

    /**
     * Switch to a profile
     */
    switchProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return false;

        this.activeProfileId = profileId;
        this.saveProfiles();
        this.renderProfileButton();

        // Notify that profile changed
        window.dispatchEvent(new CustomEvent('profile-changed', { detail: profile }));

        if (window.agentManager) {
            window.agentManager.showToast('Profile Switched', `Now using: ${profile.name}`, {
                type: 'success',
                duration: 3000
            });
        }

        return true;
    }

    /**
     * Update active profile data
     */
    updateProfile(updates) {
        const profile = this.getActiveProfile();
        if (!profile) return;

        // Deep merge
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
                profile[key] = { ...profile[key], ...updates[key] };
            } else {
                profile[key] = updates[key];
            }
        });

        this.saveProfiles();
    }

    /**
     * Delete a profile
     */
    deleteProfile(profileId) {
        if (this.profiles.length <= 1) {
            if (window.agentManager) {
                window.agentManager.showToast('Cannot Delete', 'You need at least one profile.', { type: 'error' });
            }
            return false;
        }

        this.profiles = this.profiles.filter(p => p.id !== profileId);

        if (this.activeProfileId === profileId) {
            this.activeProfileId = this.profiles[0].id;
        }

        this.saveProfiles();
        this.renderProfileButton();

        return true;
    }

    /**
     * Render profile button in navbar (between bookmarks and menu)
     */
    renderProfileButton() {
        const profile = this.getActiveProfile();
        if (!profile) return;

        // Find or create profile button
        let btn = document.getElementById('profile-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'profile-btn';
            btn.className = 'toolbar-btn profile-btn';
            btn.title = 'Switch Profile';

            // Insert before menu button in toolbar
            const menuBtn = document.getElementById('btn-menu');
            if (menuBtn && menuBtn.parentNode) {
                menuBtn.parentNode.insertBefore(btn, menuBtn);
            }

            btn.addEventListener('click', () => this.showProfileMenu());
        }

        btn.innerHTML = `<span class="profile-avatar">${profile.avatar}</span>`;
        btn.title = profile.name;
    }

    /**
     * Show profile dropdown menu
     */
    showProfileMenu() {
        // Remove existing menu
        document.querySelectorAll('.profile-menu').forEach(m => m.remove());

        const btn = document.getElementById('profile-btn');
        const rect = btn.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'profile-menu';
        // Position from the RIGHT side of button, not left (so it doesn't go off-screen)
        menu.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            right: ${window.innerWidth - rect.right}px;
            min-width: 220px;
            background: rgba(25, 25, 35, 0.98);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px;
            padding: 8px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5);
            z-index: 10000;
            opacity: 0;
            transform: translateY(-8px);
            animation: profileMenuIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        `;

        if (!document.getElementById('profile-menu-styles')) {
            const style = document.createElement('style');
            style.id = 'profile-menu-styles';
            style.textContent = `
                @keyframes profileMenuIn {
                    to { opacity: 1; transform: translateY(0); }
                }
                .profile-menu-item:hover {
                    background: rgba(255,255,255,0.08);
                }
                .profile-menu-separator {
                    height: 1px;
                    background: rgba(255,255,255,0.1);
                    margin: 4px 0;
                }
            `;
            document.head.appendChild(style);
        }

        // Profile list
        this.profiles.forEach(p => {
            const item = document.createElement('div');
            item.className = `profile-menu-item ${p.id === this.activeProfileId ? 'active' : ''}`;
            item.innerHTML = `
                <span class="profile-menu-avatar">${p.avatar}</span>
                <span class="profile-menu-name">${p.name}</span>
                ${p.id === this.activeProfileId ? '<span class="profile-check">✓</span>' : ''}
            `;
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-radius: 8px;
                cursor: pointer;
                color: #fff;
                font-size: 13px;
            `;

            item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.1)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');
            item.addEventListener('click', () => {
                this.switchProfile(p.id);
                menu.remove();
            });

            menu.appendChild(item);
        });

        // Divider
        const divider = document.createElement('div');
        divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.1); margin: 8px 0;';
        menu.appendChild(divider);

        // Edit Profile button
        const editBtn = document.createElement('div');
        editBtn.innerHTML = '✏️ Edit Profile';
        editBtn.style.cssText = 'padding: 10px 12px; border-radius: 8px; cursor: pointer; color: rgba(255,255,255,0.7); font-size: 13px;';
        editBtn.addEventListener('mouseenter', () => editBtn.style.background = 'rgba(255,255,255,0.1)');
        editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'transparent');
        editBtn.addEventListener('click', () => {
            menu.remove();
            this.showProfileEditor();
        });
        menu.appendChild(editBtn);

        // Add Profile button
        const addBtn = document.createElement('div');
        addBtn.innerHTML = '➕ Add Profile';
        addBtn.style.cssText = 'padding: 10px 12px; border-radius: 8px; cursor: pointer; color: rgba(255,255,255,0.7); font-size: 13px;';
        addBtn.addEventListener('mouseenter', () => addBtn.style.background = 'rgba(255,255,255,0.1)');
        addBtn.addEventListener('mouseleave', () => addBtn.style.background = 'transparent');
        addBtn.addEventListener('click', () => {
            menu.remove();
            this.showAddProfileDialog();
        });
        menu.appendChild(addBtn);

        document.body.appendChild(menu);

        // Close on outside click
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== btn) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    /**
     * Show profile editor modal
     */
    showProfileEditor() {
        const profile = this.getActiveProfile();
        if (!profile) return;

        const avatars = ['👤', '👨', '👩', '🧑', '👨‍💻', '👩‍💻', '🧑‍💼', '👨‍🎓', '👩‍🎓', '🦸', '🧙', '🎭'];

        const body = `
            <div style="display: grid; gap: 16px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${avatars.map(a => `
                        <span class="avatar-option ${profile.avatar === a ? 'selected' : ''}" 
                              style="font-size: 24px; padding: 8px; cursor: pointer; border-radius: 8px; ${profile.avatar === a ? 'background: rgba(139,92,246,0.3);' : ''}"
                              data-avatar="${a}">${a}</span>
                    `).join('')}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <input type="text" id="profile-firstName" placeholder="First Name" value="${profile.personal.firstName || ''}"
                           style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                    <input type="text" id="profile-lastName" placeholder="Last Name" value="${profile.personal.lastName || ''}"
                           style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                </div>
                
                <input type="email" id="profile-email" placeholder="Email" value="${profile.personal.email || ''}"
                       style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                
                <input type="tel" id="profile-phone" placeholder="Phone" value="${profile.personal.phone || ''}"
                       style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                    <input type="text" id="profile-city" placeholder="City" value="${profile.personal.address?.city || ''}"
                           style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                    <input type="text" id="profile-country" placeholder="Country" value="${profile.personal.address?.country || ''}"
                           style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                </div>
                
                <input type="text" id="profile-title" placeholder="Job Title" value="${profile.professional.title || ''}"
                       style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                
                <input type="text" id="profile-company" placeholder="Company" value="${profile.professional.company || ''}"
                       style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                
                <input type="url" id="profile-linkedin" placeholder="LinkedIn URL" value="${profile.professional.linkedin || ''}"
                       style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
            </div>
        `;

        window.agentManager.showModal('Edit Profile', body, [
            { id: 'save', label: 'Save', primary: true, onClick: () => this.saveProfileFromEditor() },
            { id: 'cancel', label: 'Cancel' }
        ], { icon: profile.avatar });

        // Avatar selection
        setTimeout(() => {
            document.querySelectorAll('.avatar-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.avatar-option').forEach(o => {
                        o.style.background = 'transparent';
                        o.classList.remove('selected');
                    });
                    opt.style.background = 'rgba(139,92,246,0.3)';
                    opt.classList.add('selected');
                });
            });
        }, 100);
    }

    /**
     * Save profile from editor inputs
     */
    saveProfileFromEditor() {
        const selectedAvatar = document.querySelector('.avatar-option.selected')?.dataset.avatar;

        this.updateProfile({
            avatar: selectedAvatar || this.getActiveProfile().avatar,
            personal: {
                firstName: document.getElementById('profile-firstName')?.value || '',
                lastName: document.getElementById('profile-lastName')?.value || '',
                email: document.getElementById('profile-email')?.value || '',
                phone: document.getElementById('profile-phone')?.value || '',
                address: {
                    city: document.getElementById('profile-city')?.value || '',
                    country: document.getElementById('profile-country')?.value || ''
                }
            },
            professional: {
                title: document.getElementById('profile-title')?.value || '',
                company: document.getElementById('profile-company')?.value || '',
                linkedin: document.getElementById('profile-linkedin')?.value || ''
            }
        });

        this.renderProfileButton();

        if (window.agentManager) {
            window.agentManager.showToast('Profile Saved', 'Your profile has been updated.', { type: 'success' });
        }
    }

    /**
     * Show add profile dialog
     */
    showAddProfileDialog() {
        const avatars = ['👤', '👨', '👩', '🧑', '👨‍💻', '👩‍💻', '🧑‍💼', '👨‍🎓', '👩‍🎓'];

        const body = `
            <div style="display: grid; gap: 16px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${avatars.map((a, i) => `
                        <span class="avatar-option ${i === 0 ? 'selected' : ''}" 
                              style="font-size: 24px; padding: 8px; cursor: pointer; border-radius: 8px; ${i === 0 ? 'background: rgba(139,92,246,0.3);' : ''}"
                              data-avatar="${a}">${a}</span>
                    `).join('')}
                </div>
                <input type="text" id="new-profile-name" placeholder="Profile Name" 
                       style="padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 14px;">
            </div>
        `;

        window.agentManager.showModal('New Profile', body, [
            {
                id: 'create', label: 'Create', primary: true, onClick: () => {
                    const name = document.getElementById('new-profile-name')?.value || 'New Profile';
                    const avatar = document.querySelector('.avatar-option.selected')?.dataset.avatar || '👤';
                    const newProfile = this.createProfile(name, avatar);
                    this.switchProfile(newProfile.id);
                }
            },
            { id: 'cancel', label: 'Cancel' }
        ], { icon: '➕' });

        // Avatar selection
        setTimeout(() => {
            document.querySelectorAll('.avatar-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.avatar-option').forEach(o => {
                        o.style.background = 'transparent';
                        o.classList.remove('selected');
                    });
                    opt.style.background = 'rgba(139,92,246,0.3)';
                    opt.classList.add('selected');
                });
            });
        }, 100);
    }
}

// Initialize global profile manager
window.profileManager = new ProfileManager();
