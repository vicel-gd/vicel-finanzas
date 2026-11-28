    const db = new Dexie('FinanzasDB');
    db.version(12).stores({
      categories: '++id, nombre, esPredeterminado, color, oculta, orden, presupuesto',
      movements: '++id, fecha, categoriaId, monto, descripcion, cuenta',
      loans: '++id, persona, monto, fecha, descripcion, estado, fechaPago, cuentaPago, movimientoCreacionId, movimientoPagoId',
      goals: '++id, nombre, costoTotal, categoriaAnclaId, lograda',
      accounts: '++id, nombre, saldoReal, fechaVerificacion'
    }).upgrade(async tx => {
      const accCount = await tx.table('accounts').count();
      if (accCount === 0) {
        await tx.table('accounts').bulkAdd([
          { nombre: 'Efectivo', saldoReal: null, fechaVerificacion: null },
          { nombre: 'Binance', saldoReal: null, fechaVerificacion: null }
        ]);
      } else {
        const accounts = await tx.table('accounts').toArray();
        for (const acc of accounts) {
          if (acc.saldoReal === undefined) {
            await tx.table('accounts').update(acc.id, { saldoReal: null, fechaVerificacion: null });
          }
        }
      }
      const cats = await tx.table('categories').toArray();
      const needsOrder = cats.some(c => c.orden === undefined);
      if (needsOrder) {
        cats.sort((a, b) => a.nombre.localeCompare(b.nombre));
        for (let i = 0; i < cats.length; i++) {
          await tx.table('categories').update(cats[i].id, { orden: i });
        }
      }
      const movements = await tx.table('movements').toArray();
      for (const mov of movements) {
        if (typeof mov.fecha !== 'string') {
          const d = new Date(mov.fecha);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            await tx.table('movements').update(mov.id, { fecha: `${y}-${m}-${day}` });
          }
        }
      }
      const loans = await tx.table('loans').toArray();
      for (const loan of loans) {
        if (typeof loan.fecha !== 'string') {
          const d = new Date(loan.fecha);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            await tx.table('loans').update(loan.id, { fecha: `${y}-${m}-${day}` });
          }
        }
        if (loan.fechaPago && typeof loan.fechaPago !== 'string') {
          const d = new Date(loan.fechaPago);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            await tx.table('loans').update(loan.id, { fechaPago: `${y}-${m}-${day}` });
          }
        }
      }
    });

    db.version(13).stores({
      categories: '++id, nombre, esPredeterminado, color, oculta, orden, presupuesto',
      movements: '++id, fecha, categoriaId, monto, descripcion, cuenta, grupoId',
      loans: '++id, persona, monto, fecha, descripcion, estado, fechaPago, cuentaPago, movimientoCreacionId, movimientoPagoId',
      goals: '++id, nombre, costoTotal, categoriaAnclaId, lograda',
      accounts: '++id, nombre, saldoReal, fechaVerificacion'
    });

    db.version(14).stores({
      categories: '++id, nombre, esPredeterminado, color, oculta, orden, presupuesto',
      movements: '++id, fecha, categoriaId, monto, descripcion, cuenta, grupoId',
      loans: '++id, persona, monto, fecha, descripcion, estado, fechaPago, cuentaPago, movimientoCreacionId, movimientoPagoId',
      goals: '++id, nombre, costoTotal, categoriaAnclaId, lograda',
      accounts: '++id, nombre, saldoReal, fechaVerificacion, color'
    }).upgrade(async tx => {
      const accounts = await tx.table('accounts').toArray();
      for (const acc of accounts) {
        if (!acc.color) {
          await tx.table('accounts').update(acc.id, { color: '#888888' });
        }
      }
    });

    db.version(17).stores({
      categories: '++id, nombre, esPredeterminado, color, oculta, orden, presupuesto',
      movements: '++id, fecha, categoriaId, monto, descripcion, cuenta, grupoId',
      loans: '++id, persona, monto, fecha, descripcion, estado, fechaPago, cuentaPago, movimientoCreacionId, movimientoPagoId',
      goals: '++id, nombre, costoTotal, categoriaAnclaId, lograda',
      accounts: '++id, nombre, saldoReal, fechaVerificacion, color'
    });

    db.version(18).stores({
      categories: '++id, nombre, esPredeterminado, color, oculta, orden, presupuesto',
      movements: '++id, fecha, categoriaId, monto, descripcion, cuenta, grupoId',
      loans: '++id, persona, monto, fecha, descripcion, estado, fechaPago, cuentaPago, movimientoCreacionId, movimientoPagoId, tipo',
      goals: '++id, nombre, costoTotal, categoriaAnclaId, lograda',
      accounts: '++id, nombre, saldoReal, fechaVerificacion, color'
    }).upgrade(async tx => {
      const loans = await tx.table('loans').toArray();
      for (const loan of loans) {
        if (!loan.tipo) await tx.table('loans').update(loan.id, { tipo: 'cobro' });
      }
    });

    db.version(19).stores({
      enterprises: '++id, nombre, producto, cantidadLote, costoUnitarioDolar, precioVentaBs, tasaBcv, margenObjetivo, umbralAlerta, redondeoComercial, fechaCreacion',
      enterprise_debtors: '++id, enterpriseId, nombrePersona, cantidadProductos, totalAPagar, fechaRegistro, pagado'
    });

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let paidMonth = new Date().getMonth();
    let paidYear = new Date().getFullYear();
    let chartInstance = null;
    let showAllMovements = false;
    let sortableInstance = null;
    const expandedGroups = new Set();
    let logoBase64Cache = null;

    let statsMonth = new Date().getMonth();
    let statsYear = new Date().getFullYear();
    let statsChartDonaInstance = null;
    let statsChartDiasInstance = null;

    let privacyMode = false;
    let daltonicMode = false;

    let currentIntercambioStep = 1;

    const defaultCategories = ['Ocio', 'Pasaje', 'Comida', 'Alquiler', 'Aseo personal'];

    function parseLocalDate(dateStr) {
      const parts = dateStr.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    function formatDateLocal(date) {
      return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    function getTodayLocal() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    
    /* ================== FORMATEO DE MONEDA (v45.4) ================== */
    // Con signo: '-' siempre para negativos significativos. '+' SOLO en Modo Daltónico.
    // Si el monto redondeado a 2 decimales es cero, no se muestra signo negativo (evita "-0,00$").
    function formatCurrency(value) {
      const num = Number(value) || 0;
      const abs = Math.abs(num);
      const absRounded = Math.round(abs * 100) / 100;
      let sign = '';
      if (num < 0 && absRounded > 0) sign = '-';
      else if (num > 0 && daltonicMode) sign = '+';
      return sign + abs.toFixed(2).replace('.', ',') + '$';
    }
    function formatCurrencyAbs(value) {
      const abs = Math.abs(Number(value) || 0);
      return abs.toFixed(2).replace('.', ',') + '$';
    }
    function formatCurrencyPrivacy(value) {
      if (privacyMode) return '•••••';
      return formatCurrency(value);
    }
    function formatCurrencyPrivacyAbs(value) {
      if (privacyMode) return '•••••';
      return formatCurrencyAbs(value);
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function showToast(state) {
      const toast = document.getElementById('syncToast');
      const text = document.getElementById('syncToastText');
      const icon = document.getElementById('syncToastIcon');
      if (!toast || !text || !icon) return;

      clearTimeout(window.toastTimeout);

      if (state === 'saving') {
        icon.innerHTML = '<div class="spinner"></div>';
        text.textContent = 'Guardando...';
        toast.classList.add('show');
      } else if (state === 'success') {
        icon.innerHTML = '<i class="bi bi-check-circle-fill" style="color: #28a745; font-size: 20px;"></i>';
        text.textContent = '¡Guardado!';
        toast.classList.add('show');
        window.toastTimeout = setTimeout(() => {
          toast.classList.remove('show');
        }, 2000);
      } else if (state === 'error') {
        icon.innerHTML = '<i class="bi bi-exclamation-circle-fill" style="color: #dc3545; font-size: 20px;"></i>';
        text.textContent = 'Error al guardar';
        toast.classList.add('show');
        window.toastTimeout = setTimeout(() => {
          toast.classList.remove('show');
        }, 3000);
      }
    }

    function updatePrivacyButton() {
      const btn = document.getElementById('privacyToggle');
      if (!btn) return;
      if (privacyMode) {
        btn.innerHTML = '<i class="bi bi-eye-slash-fill"></i>';
        btn.title = 'Mostrar números';
        btn.setAttribute('aria-label', 'Mostrar números');
        btn.classList.add('active');
      } else {
        btn.innerHTML = '<i class="bi bi-eye-fill"></i>';
        btn.title = 'Ocultar números';
        btn.setAttribute('aria-label', 'Ocultar números');
        btn.classList.remove('active');
      }
      const switchEl = document.getElementById('settingsPrivacyToggle');
      if (switchEl) switchEl.checked = privacyMode;
    }

    function togglePrivacy() {
      privacyMode = !privacyMode;
      try {
        localStorage.setItem('vicel_privacy_mode', privacyMode ? '1' : '0');
      } catch (e) {}
      document.body.classList.toggle('privacy-mode', privacyMode);
      updatePrivacyButton();
      refreshAll();
    }

    function loadPrivacyMode() {
      try {
        privacyMode = localStorage.getItem('vicel_privacy_mode') === '1';
      } catch (e) {
        privacyMode = false;
      }
      document.body.classList.toggle('privacy-mode', privacyMode);
      updatePrivacyButton();
    }

    function toggleDaltonic() {
      daltonicMode = !daltonicMode;
      try {
        localStorage.setItem('vicel_daltonic_mode', daltonicMode ? '1' : '0');
      } catch (e) {}
      updateDaltonicUI();
      refreshAll();
    }

    function loadDaltonicMode() {
      try {
        daltonicMode = localStorage.getItem('vicel_daltonic_mode') === '1';
      } catch (e) {
        daltonicMode = false;
      }
      updateDaltonicUI();
    }

    function updateDaltonicUI() {
      const switchEl = document.getElementById('daltonicToggle');
      if (switchEl) switchEl.checked = daltonicMode;
      if (daltonicMode) {
        document.body.classList.add('daltonic');
      } else {
        document.body.classList.remove('daltonic');
      }
    }

    async function getCategoryBalancesMap() {
      const movements = await db.movements.toArray();
      const map = {};
      movements.forEach(m => {
        if (m.categoriaId) {
          map[m.categoriaId] = (map[m.categoriaId] || 0) + m.monto;
        }
      });
      return map;
    }

    function categoryOptionText(cat, balancesMap) {
      const bal = balancesMap[cat.id] || 0;
      return `${cat.nombre} — ${formatCurrency(bal)}`;
    }

    function splitCategoryText(text) {
      if (!text) return { name: '', amount: '', isNegative: false };
      const m = String(text).match(/^(.*?)\s+—\s+(.+)$/);
      if (m) {
        const amount = m[2].trim();
        return {
          name: m[1].trim(),
          amount: amount,
          isNegative: amount.startsWith('-')
        };
      }
      return { name: String(text).trim(), amount: '', isNegative: false };
    }

    function enhanceCategorySelect(select) {
      if (!select) return;
      if (!select.dataset.enhanced) {
        select.dataset.enhanced = '1';

        const wrap = document.createElement('div');
        wrap.className = 'csel-wrap';
        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'csel-btn';
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.innerHTML = '<span class="csel-btn-content"><span class="csel-name"></span><span class="csel-amount"></span></span><i class="bi bi-chevron-down"></i>';
        wrap.appendChild(btn);

        const panel = document.createElement('div');
        panel.className = 'csel-panel';
        panel.setAttribute('role', 'listbox');
        wrap.appendChild(panel);

        select.style.display = 'none';
        select._cselBtn = btn;
        select._cselPanel = panel;
        select._cselWrap = wrap;

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasOpen = panel.classList.contains('open');
          document.querySelectorAll('.csel-panel.open').forEach(p => p.classList.remove('open'));
          document.querySelectorAll('.csel-btn.open').forEach(b => b.classList.remove('open'));
          if (!wasOpen) {
            renderCselOptions(select);
            panel.classList.add('open');
            btn.classList.add('open');
            panel.style.top = 'calc(100% + 4px)';
            panel.style.bottom = 'auto';
            const rect = panel.getBoundingClientRect();
            if (rect.bottom > window.innerHeight - 8) {
              panel.style.top = 'auto';
              panel.style.bottom = 'calc(100% + 4px)';
            }
          }
        });

        document.addEventListener('click', (e) => {
          if (!wrap.contains(e.target)) {
            panel.classList.remove('open');
            btn.classList.remove('open');
          }
        });

        select.addEventListener('change', () => {
          renderCselLabel(select);
        });
      }
      renderCselLabel(select);
    }

    function renderCselLabel(select) {
      const btn = select._cselBtn;
      if (!btn) return;
      const opt = select.options[select.selectedIndex];
      const nameEl = btn.querySelector('.csel-name');
      const amountEl = btn.querySelector('.csel-amount');
      if (!opt) {
        nameEl.textContent = '';
        amountEl.textContent = '';
        amountEl.className = 'csel-amount';
        return;
      }
      const parts = splitCategoryText(opt.textContent);
      nameEl.textContent = parts.name;
      amountEl.textContent = parts.amount || '';
      amountEl.className = 'csel-amount ' + (parts.isNegative ? 'negative' : 'positive');
    }

    function renderCselOptions(select) {
      const panel = select._cselPanel;
      if (!panel) return;
      panel.innerHTML = '';
      Array.from(select.options).forEach(opt => {
        const row = document.createElement('div');
        row.className = 'csel-opt';
        row.setAttribute('role', 'option');
        if (opt.selected) row.classList.add('selected');
        if (opt.disabled) row.classList.add('disabled');

        const parts = splitCategoryText(opt.textContent);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'csel-name';
        nameSpan.textContent = parts.name;
        row.appendChild(nameSpan);

        if (parts.amount) {
          const amountSpan = document.createElement('span');
          amountSpan.className = 'csel-amount ' + (parts.isNegative ? 'negative' : 'positive');
          amountSpan.textContent = parts.amount;
          row.appendChild(amountSpan);
        }

        if (!opt.disabled) {
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            panel.classList.remove('open');
            select._cselBtn.classList.remove('open');
          });
        }

        panel.appendChild(row);
      });
    }

    document.addEventListener('hidden.bs.modal', () => {
      document.querySelectorAll('.csel-panel.open').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.csel-btn.open').forEach(b => b.classList.remove('open'));
    });

    const CLIENT_ID = '312694298965-j8kbfete84pqsfetfbms0hic84mukp6h.apps.googleusercontent.com';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    let tokenClient = null;
    let accessToken = null;
    let tokenExpiry = null;
    let driveFileId = null;
    let syncDebounceTimer = null;
    let isGoogleSession = false;

    const authButtons = document.getElementById('authButtons');
    const authStatusIndicator = document.getElementById('authStatusIndicator');
    const syncPill = document.getElementById('syncPill');
    const logoutContainer = document.getElementById('logoutContainer');
    const landingPage = document.getElementById('landingPage');
    const mainContent = document.getElementById('mainContent');

    function showApp() {
      landingPage.classList.add('hidden');
      mainContent.style.display = 'block';
      setTimeout(() => { if (chartInstance) chartInstance.resize(); }, 300);
    }
    function showLanding() {
      landingPage.classList.remove('hidden');
      mainContent.style.display = 'none';
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
    }
    function initGoogleAuth() {
      try {
        if (typeof google === 'undefined' || !google.accounts) {
          console.warn('Google Identity Services no está disponible.');
          return;
        }
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPES,
          callback: (resp) => {
            if (resp.error) { console.error('Error al obtener token:', resp); logout(); return; }
            accessToken = resp.access_token;
            tokenExpiry = Date.now() + (resp.expires_in * 1000);
            isGoogleSession = true;
            updateAuthUI(true);
            findOrCreateDriveFile(accessToken);
            scheduleTokenRefresh(resp.expires_in);
            showApp();
          },
          error_callback: (err) => { console.error('Error en tokenClient:', err); alert('No se pudo iniciar sesión con Google. Intenta nuevamente o usa "Iniciar prueba" para continuar sin Drive.'); logout(); }
        });
      } catch (e) { console.error('Error al inicializar Google Auth:', e); }
    }
    function scheduleTokenRefresh(expiresIn) {
      const refreshMs = (expiresIn - 300) * 1000;
      if (refreshMs > 0) {
        setTimeout(() => { if (accessToken && tokenClient) tokenClient.requestAccessToken({ prompt: '' }); }, refreshMs);
      }
    }
    function loginWithGoogle() {
      if (!tokenClient) initGoogleAuth();
      if (!tokenClient) { alert('La autenticación con Google no está disponible. Intenta con "Iniciar prueba".'); return; }
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
    function logout() {
      const tokenToRevoke = accessToken;
      accessToken = null; tokenExpiry = null; driveFileId = null; isGoogleSession = false;
      updateAuthUI(false);
      if (tokenToRevoke && google.accounts && google.accounts.oauth2) { try { google.accounts.oauth2.revoke(tokenToRevoke); } catch (e) {} }
      showLanding();
    }
    function updateAuthUI(loggedIn) {
      if (loggedIn) {
        authButtons.style.display = 'none';
        authStatusIndicator.style.display = 'block';
        logoutContainer.style.display = 'flex';
        syncPill.textContent = 'Conectado a Drive';
      } else {
        authButtons.style.display = 'block';
        authStatusIndicator.style.display = 'none';
        logoutContainer.style.display = 'none';
      }
    }

    async function findOrCreateDriveFile(token) {
      try {
        const searchResp = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='vicel_finanzas_data.json' and trashed=false&fields=files(id,name)`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const searchResult = await searchResp.json();
        if (searchResult.files && searchResult.files.length > 0) {
          driveFileId = searchResult.files[0].id;
          const confirmLoad = confirm('Se encontraron datos guardados en tu Google Drive. ¿Deseas cargarlos?\nEsto reemplazará los datos actuales en este navegador.');
          if (confirmLoad) await loadFromDrive(token, driveFileId);
          else await uploadToDrive(token, driveFileId);
        } else {
          driveFileId = await createDriveFile(token);
        }
      } catch (e) {
        console.error('Error en findOrCreateDriveFile:', e);
        alert('Error al conectar con Google Drive. Los cambios no se sincronizarán.');
      }
    }
    async function createDriveFile(token) {
      const exportData = await exportAllData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ name: 'vicel_finanzas_data.json', mimeType: 'application/json' })], { type: 'application/json' }));
      formData.append('file', blob);
      const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData
      });
      const uploadResult = await resp.json();
      if (resp.ok && uploadResult.id) return uploadResult.id;
      throw new Error('Error al crear archivo: ' + JSON.stringify(uploadResult));
    }
    async function uploadToDrive(token, fileId) {
      if (!fileId) return;
      const exportData = await exportAllData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ name: 'vicel_finanzas_data.json', mimeType: 'application/json' })], { type: 'application/json' }));
      formData.append('file', blob);
      const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: formData
      });
      if (!resp.ok) { const errorData = await resp.json(); throw new Error('Error al subir archivo: ' + JSON.stringify(errorData)); }
      return true;
    }
    async function loadFromDrive(token, fileId) {
      try {
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error('Error al descargar archivo');
        const driveData = await resp.json();
        await db.transaction('rw', db.categories, db.movements, db.loans, db.goals, db.accounts, db.enterprises, db.enterprise_debtors, async () => {
          await db.categories.clear(); await db.movements.clear(); await db.loans.clear();
          await db.goals.clear(); await db.accounts.clear();
          await db.enterprises.clear(); await db.enterprise_debtors.clear();
          if (driveData.categories) await db.categories.bulkAdd(driveData.categories);
          if (driveData.movements) await db.movements.bulkAdd(driveData.movements);
          if (driveData.loans) await db.loans.bulkAdd(driveData.loans);
          if (driveData.goals) await db.goals.bulkAdd(driveData.goals);
          if (driveData.accounts) await db.accounts.bulkAdd(driveData.accounts);
          if (driveData.enterprises) await db.enterprises.bulkAdd(driveData.enterprises);
          if (driveData.enterpriseDebtors) await db.enterprise_debtors.bulkAdd(driveData.enterpriseDebtors);
        });
        await refreshAll();
        syncPill.textContent = 'Datos cargados desde Drive';
        setTimeout(() => { if (isGoogleSession) syncPill.textContent = 'Conectado a Drive'; }, 3000);
      } catch (e) {
        console.error('Error al cargar desde Drive:', e);
        alert('Error al cargar los datos desde Drive. Se mantendrán los datos locales.');
      }
    }
    async function exportAllData() {
      const categories = await db.categories.toArray();
      const movements = await db.movements.toArray();
      const loans = await db.loans.toArray();
      const goals = await db.goals.toArray();
      const accounts = await db.accounts.toArray();
      const enterprises = await db.enterprises.toArray();
      const enterpriseDebtors = await db.enterprise_debtors.toArray();
      return { version: 1, lastUpdated: new Date().toISOString(), categories, movements, loans, goals, accounts, enterprises, enterpriseDebtors };
    }
    function scheduleSync() {
      if (!accessToken || !driveFileId) return;
      showToast('saving');
      syncPill.textContent = 'Guardando...';
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(async () => {
        try {
          await uploadToDrive(accessToken, driveFileId);
          syncPill.textContent = 'Guardado';
          showToast('success');
          setTimeout(() => { if (isGoogleSession) syncPill.textContent = 'Conectado a Drive'; }, 2000);
        } catch (e) {
          console.error('Error al sincronizar:', e);
          syncPill.textContent = 'Error al guardar';
          showToast('error');
          setTimeout(() => { if (isGoogleSession) syncPill.textContent = 'Conectado a Drive'; }, 3000);
        }
        syncDebounceTimer = null;
      }, 3000);
    }

    document.addEventListener('DOMContentLoaded', async () => {
      try {
        await db.open();
        try {
          const loanCat = await db.categories.where('nombre').equalsIgnoreCase('PRÉSTAMO').first();
          if (loanCat && !loanCat.oculta) { await db.categories.update(loanCat.id, { oculta: 1 }); }
        } catch (e) { console.warn('No se pudo ocultar la categoría PRÉSTAMO:', e); }

        loadPrivacyMode();
        loadDaltonicMode();

        await loadDefaultData();
        await refreshAll();
        setupTabs();
        updateMonthLabel();

        document.querySelectorAll('.loan-toggle-btn').forEach(btn => {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.loan-toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const input = this.querySelector('input');
            if (input) input.checked = true;
          });
        });

        document.getElementById('filterSearch').addEventListener('input', applyFilters);
        document.getElementById('filterType').addEventListener('change', applyFilters);
        document.getElementById('filterCategory').addEventListener('change', applyFilters);
        document.getElementById('filterAccount').addEventListener('change', applyFilters);
        const loanSearchInput = document.getElementById('loanSearchPerson');
        if (loanSearchInput) loanSearchInput.addEventListener('input', refreshLoans);

        document.getElementById('menuToggle').addEventListener('click', () => {
          document.getElementById('sidebar').classList.toggle('open');
          document.getElementById('sidebarOverlay').classList.toggle('active');
        });
        document.getElementById('sidebarOverlay').addEventListener('click', () => {
          document.getElementById('sidebar').classList.remove('open');
          document.getElementById('sidebarOverlay').classList.remove('active');
        });

        document.querySelectorAll('#statsTabs button').forEach(tabBtn => {
          tabBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#statsTabs button').forEach(btn => btn.classList.remove('active'));
            tabBtn.classList.add('active');
            document.querySelectorAll('.stats-subtab-pane').forEach(pane => {
              pane.classList.remove('show', 'active');
            });
            const targetId = tabBtn.getAttribute('data-bs-target');
            const targetPane = document.querySelector(targetId);
            if (targetPane) {
              targetPane.classList.add('show', 'active');
            }
            if (targetId === '#pane-resumen') {
              if (statsChartDonaInstance) statsChartDonaInstance.resize();
              if (statsChartDiasInstance) statsChartDiasInstance.resize();
            }
          });
        });

        setupFormSubmissions();

        document.getElementById('movementAmount').addEventListener('input', updateMovementFeedback);
        document.querySelectorAll('input[name="movementType"]').forEach(radio => {
            radio.addEventListener('change', updateMovementFeedback);
        });
        document.querySelectorAll('#intercambioForm input, #intercambioForm select').forEach(el => {
            el.addEventListener('change', checkIntercambioStepValidity);
            el.addEventListener('input', checkIntercambioStepValidity);
        });
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('input', checkFormValidity);
            form.addEventListener('change', checkFormValidity);
        });

        document.getElementById('btnLoginLanding').addEventListener('click', () => {
          try { loginWithGoogle(); }
          catch (e) { console.error('Error en login:', e); alert('Error al iniciar sesión con Google.'); }
        });
        document.getElementById('btnTrialLanding').addEventListener('click', async () => {
          try {
            isGoogleSession = false;
            updateAuthUI(false);
            await resetToTrialDefaults();
            await refreshAll();
            showApp();
          } catch (e) {
            console.error('Error en modo prueba:', e);
            alert('Error al iniciar modo prueba: ' + e.message);
          }
        });
        try { initGoogleAuth(); } catch (e) { console.warn('No se pudo inicializar Google Auth:', e); }
      } catch (e) {
        console.error('Error en inicialización:', e);
        alert('Error al inicializar la aplicación.');
      }
    });

    function checkFormValidity() {
      const movForm = document.getElementById('movementForm');
      const movBtn = document.getElementById('btn-save-movement');
      if (movForm && movBtn) {
        const amount = parseFloat(document.getElementById('movementAmount').value);
        movBtn.disabled = !(movForm.checkValidity() && amount > 0);
      }
      const loanForm = document.getElementById('loanForm');
      const loanBtn = document.getElementById('btn-save-loan');
      if (loanForm && loanBtn) {
        const amount = parseFloat(document.getElementById('loanAmount').value);
        loanBtn.disabled = !(loanForm.checkValidity() && amount > 0);
      }
      const goalForm = document.getElementById('goalForm');
      const goalBtn = document.getElementById('btn-save-goal');
      if (goalForm && goalBtn) {
        const amount = parseFloat(document.getElementById('goalTotal').value);
        goalBtn.disabled = !(goalForm.checkValidity() && amount > 0);
      }
      const redondeoForm = document.getElementById('redondeoForm');
      const redondeoBtn = document.getElementById('btn-save-redondeo');
      if (redondeoForm && redondeoBtn) {
        const amount = parseFloat(document.getElementById('redondeoAmount').value);
        redondeoBtn.disabled = !(redondeoForm.checkValidity() && amount > 0);
      }
      const catForm = document.getElementById('categoryForm');
      const catBtn = document.getElementById('btn-save-category');
      if (catForm && catBtn) {
          catBtn.disabled = !catForm.checkValidity();
      }
      const accForm = document.getElementById('accountForm');
      const accBtn = document.getElementById('btn-save-account');
      if (accForm && accBtn) {
          accBtn.disabled = !accForm.checkValidity();
      }
    }

    function checkIntercambioStepValidity() {
      const btnSiguiente = document.getElementById('btn-intercambio-siguiente');
      if (currentIntercambioStep === 1) {
        const date = document.getElementById('intercambioDate').value;
        const amount = parseFloat(document.getElementById('intercambioAmount').value);
        const catA = document.getElementById('intercambioCatA').value;
        const accA = document.getElementById('intercambioCuentaA').value;
        btnSiguiente.disabled = !(date && amount > 0 && catA && accA);
      } else if (currentIntercambioStep === 2) {
        const catB = document.getElementById('intercambioCatB').value;
        const accB = document.getElementById('intercambioCuentaB').value;
        btnSiguiente.disabled = !(catB && accB);
      }
    }

    function updateMovementFeedback() {
      const amountInput = document.getElementById('movementAmount');
      const feedbackEl = document.getElementById('amountFeedback');
      const type = document.querySelector('input[name="movementType"]:checked').value;
      const amount = parseFloat(amountInput.value);

      if (amount > 0) {
        const montoFinal = type === 'egreso' ? -amount : amount;
        feedbackEl.innerHTML = `Se guardará como: <strong>${formatCurrency(montoFinal)}</strong>`;
      } else {
        feedbackEl.innerHTML = '';
      }
      checkFormValidity();
    }

    async function loadDefaultData() {
      const catCount = await db.categories.count();
      if (catCount === 0) {
        for (const nombre of defaultCategories) {
          await db.categories.add({ nombre, esPredeterminado: 1, color: '#E8622C', oculta: 0 });
        }
        const cats = await db.categories.toArray();
        cats.sort((a, b) => a.nombre.localeCompare(b.nombre));
        for (let i = 0; i < cats.length; i++) {
          await db.categories.update(cats[i].id, { orden: i });
        }
      }
      const accCount = await db.accounts.count();
      if (accCount === 0) {
        await db.accounts.bulkAdd([
          { nombre: 'Efectivo', saldoReal: null, fechaVerificacion: null, color: '#90EE90' },
          { nombre: 'Binance', saldoReal: null, fechaVerificacion: null, color: '#FFF7A0' }
        ]);
      }
    }
    async function resetToTrialDefaults() {
      try {
        await db.transaction('rw', db.categories, db.movements, db.loans, db.goals, db.accounts, db.enterprises, db.enterprise_debtors, async () => {
          await db.categories.clear(); await db.movements.clear();
          await db.loans.clear(); await db.goals.clear(); await db.accounts.clear();
          await db.enterprises.clear(); await db.enterprise_debtors.clear();
        });
        await loadDefaultData();
      } catch (e) { console.error('Error en resetToTrialDefaults:', e); throw e; }
    }
    async function exportData() {
      try {
        const data = await exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vicel_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) { console.error('Error al exportar:', e); alert('Error al exportar los datos.'); }
    }
    async function importData(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.categories || !data.movements || !data.loans || !data.goals || !data.accounts) {
          alert('El archivo no tiene el formato esperado.'); return;
        }
        if (!confirm('Esto reemplazará todos los datos actuales. ¿Continuar?')) return;
        await db.transaction('rw', db.categories, db.movements, db.loans, db.goals, db.accounts, db.enterprises, db.enterprise_debtors, async () => {
          await db.categories.clear(); await db.movements.clear();
          await db.loans.clear(); await db.goals.clear(); await db.accounts.clear();
          await db.enterprises.clear(); await db.enterprise_debtors.clear();
          await db.categories.bulkAdd(data.categories);
          await db.movements.bulkAdd(data.movements);
          await db.loans.bulkAdd(data.loans);
          await db.goals.bulkAdd(data.goals);
          await db.accounts.bulkAdd(data.accounts);
          if (data.enterprises) await db.enterprises.bulkAdd(data.enterprises);
          if (data.enterpriseDebtors) await db.enterprise_debtors.bulkAdd(data.enterpriseDebtors);
        });
        await refreshAll();
        alert('Datos importados correctamente.');
        scheduleSync();
      } catch (e) { console.error('Error al importar:', e); alert('Error al importar los datos.'); }
      event.target.value = '';
    }
    async function resetAllData() {
      if (!confirm('¿Estás seguro de reiniciar todos los datos? Esta acción no se puede deshacer.')) return;
      try {
        await db.transaction('rw', db.categories, db.movements, db.loans, db.goals, db.accounts, db.enterprises, db.enterprise_debtors, async () => {
          await db.categories.clear(); await db.movements.clear();
          await db.loans.clear(); await db.goals.clear(); await db.accounts.clear();
          await db.enterprises.clear(); await db.enterprise_debtors.clear();
        });
        await loadDefaultData();
        await refreshAll();
        alert('Datos reiniciados correctamente.');
        scheduleSync();
      } catch (e) { console.error('Error al reiniciar datos:', e); alert('Error al reiniciar los datos.'); }
    }
    function setupFormSubmissions() {
      const formConfigs = [
        { id: 'movementForm', saveFn: saveMovement },
        { id: 'loanForm', saveFn: saveLoan },
        { id: 'goalForm', saveFn: saveGoal },
        { id: 'categoryForm', saveFn: saveCategory },
        { id: 'accountForm', saveFn: saveAccount }
      ];
      formConfigs.forEach(({ id, saveFn }) => {
        const form = document.getElementById(id);
        if (!form) return;
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          if (this.checkValidity()) saveFn(); else this.reportValidity();
        });
        const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea'));
        inputs.forEach((input, index) => {
          input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (this.tagName === 'SELECT') { try { this.showPicker(); } catch (err) { this.focus(); } return; }
              if (index === inputs.length - 1) form.requestSubmit();
              else { const nextInput = inputs[index + 1]; if (nextInput) nextInput.focus(); }
            }
          });
          if (input.tagName === 'SELECT') {
            input.addEventListener('change', function() {
              if (index === inputs.length - 1) form.requestSubmit();
              else { const nextInput = inputs[index + 1]; if (nextInput) nextInput.focus(); }
            });
          }
        });
      });
    }

    async function refreshAll() {
      await refreshDashboard();
      await refreshMovements();
      await refreshLoans();
      await refreshPersonTotals();
      await refreshGoals();
      await refreshStats();
      await refreshCategoriesDropdown();
      await refreshCategoriesList();
      await refreshAccountsList();
      await refreshFilterDropdowns();
    }

    function changeStatsMonth(delta) {
      statsMonth += delta;
      if (statsMonth < 0) { statsMonth = 11; statsYear--; }
      if (statsMonth > 11) { statsMonth = 0; statsYear++; }
      refreshStats();
    }

    function updateStatsMonthLabel() {
      const date = new Date(statsYear, statsMonth);
      const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      document.getElementById('statsMonthLabel').textContent = label;
    }

    function isSpecialNonExpenseMovement(m) {
      if (!m.grupoId) return false;
      return m.grupoId.startsWith('redondeo_') || m.grupoId.startsWith('intercambio_');
    }

    async function refreshStats() {
      updateStatsMonthLabel();

      const prefix = `${statsYear}-${String(statsMonth + 1).padStart(2, '0')}`;
      const allMovements = await db.movements.toArray();
      
      const allLoans = await db.loans.toArray();
      const loanMovIds = new Set();
      allLoans.forEach(l => {
        if (l.movimientoCreacionId) loanMovIds.add(l.movimientoCreacionId);
        if (l.movimientoPagoId) loanMovIds.add(l.movimientoPagoId);
      });

      const movsMes = allMovements.filter(m => {
        if (!m.fecha || !m.fecha.startsWith(prefix)) return false;
        if (isSpecialNonExpenseMovement(m)) return false;
        if (loanMovIds.has(m.id)) return false;
        return true;
      });

      let totalGastado = 0;
      let totalIngresado = 0;
      movsMes.forEach(m => {
        if (m.monto < 0) totalGastado += Math.abs(m.monto);
        else if (m.monto > 0) totalIngresado += m.monto;
      });
      const balance = totalIngresado - totalGastado;

      const hoy = new Date();
      const esMesActual = (statsYear === hoy.getFullYear() && statsMonth === hoy.getMonth());
      let diasConsiderados;
      if (esMesActual) diasConsiderados = hoy.getDate();
      else diasConsiderados = new Date(statsYear, statsMonth + 1, 0).getDate();
      if (diasConsiderados < 1) diasConsiderados = 1;
      const promedioDiario = totalGastado / diasConsiderados;

      document.getElementById('statsTotalGastado').textContent = formatCurrencyPrivacyAbs(totalGastado);
      document.getElementById('statsTotalIngresado').textContent = formatCurrencyPrivacyAbs(totalIngresado);

      const balanceEl = document.getElementById('statsBalance');
      balanceEl.textContent = formatCurrencyPrivacy(balance);
      balanceEl.className = 'stats-value ' + (balance >= 0 ? 'positive' : 'negative');

      document.getElementById('statsPromedio').textContent = formatCurrencyPrivacyAbs(promedioDiario);

      let pmIdx = statsMonth - 1, pyIdx = statsYear;
      if (pmIdx < 0) { pmIdx = 11; pyIdx--; }
      const prevPrefix = `${pyIdx}-${String(pmIdx + 1).padStart(2, '0')}`;
      const totalGastadoPrev = allMovements
        .filter(m => m.fecha && m.fecha.startsWith(prevPrefix) && m.monto < 0 && !isSpecialNonExpenseMovement(m) && !loanMovIds.has(m.id))
        .reduce((s, m) => s + Math.abs(m.monto), 0);

      const compEl = document.getElementById('statsComparison');
      const prevMonthName = new Date(pyIdx, pmIdx).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

      if (totalGastadoPrev === 0 && totalGastado === 0) {
        compEl.className = 'stats-comparison neutral';
        compEl.innerHTML = '<i class="bi bi-info-circle"></i> No hay gastos registrados este mes ni en ' + prevMonthName + '.';
      } else if (totalGastadoPrev === 0) {
        compEl.className = 'stats-comparison neutral';
        compEl.innerHTML = '<i class="bi bi-info-circle"></i> No hay gastos registrados en ' + prevMonthName + ' para comparar.';
      } else {
        const diff = totalGastado - totalGastadoPrev;
        const pct = (diff / totalGastadoPrev) * 100;
        const absPct = Math.abs(pct).toFixed(1).replace('.', ',');
        if (Math.abs(pct) < 0.05) {
          compEl.className = 'stats-comparison neutral';
          compEl.innerHTML = '<i class="bi bi-dash-circle"></i> Gastaste prácticamente lo mismo que en <strong>' + prevMonthName + '</strong>.';
        } else if (diff > 0) {
          compEl.className = 'stats-comparison negative';
          compEl.innerHTML = '<i class="bi bi-arrow-up-circle"></i> Gastaste <strong>' + absPct + '%</strong> más que en ' + prevMonthName + ' (' + formatCurrencyPrivacyAbs(totalGastadoPrev) + ').';
        } else {
          compEl.className = 'stats-comparison positive';
          compEl.innerHTML = '<i class="bi bi-arrow-down-circle"></i> Gastaste <strong>' + absPct + '%</strong> menos que en ' + prevMonthName + ' (' + formatCurrencyPrivacyAbs(totalGastadoPrev) + ').';
        }
      }

      const categories = await db.categories.toArray();
      const catMap = {};
      categories.forEach(c => catMap[c.id] = c.nombre);
      const byCat = {};
      movsMes.forEach(m => {
        if (m.monto < 0) {
          const name = catMap[m.categoriaId] || 'Sin categoría';
          byCat[name] = (byCat[name] || 0) + Math.abs(m.monto);
        }
      });
      const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

      const donaCanvas = document.getElementById('statsChartDona');
      const donaPrivacy = document.getElementById('statsChartDonaPrivacy');
      if (statsChartDonaInstance) { statsChartDonaInstance.destroy(); statsChartDonaInstance = null; }

      if (privacyMode) {
        if (donaCanvas) donaCanvas.style.display = 'none';
        if (donaPrivacy) donaPrivacy.style.display = 'flex';
      } else {
        if (donaCanvas) donaCanvas.style.display = '';
        if (donaPrivacy) donaPrivacy.style.display = 'none';
        if (catEntries.length === 0) {
          statsChartDonaInstance = new Chart(donaCanvas, {
            type: 'doughnut',
            data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#e8e2d0'] }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false } } }
          });
        } else {
          const palette = daltonicMode 
            ? ['#0072B2','#E69F00','#56B4E9','#009E73','#F0E442','#CC79A7','#999999'] 
            : ['#e2781f','#FFB347','#FFD93D','#6BCB77','#4D96FF','#845EC2','#FF6B6B','#00C9A7','#FF9671','#C34A36','#A8E6CF','#DDA0DD','#87CEEB','#F0E68C','#E6A8D7'];
          const labels = catEntries.map(e => e[0]);
          const data = catEntries.map(e => e[1]);
          const colors = labels.map((_, i) => palette[i % palette.length]);
          statsChartDonaInstance = new Chart(donaCanvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff7e0', hoverOffset: 10 }] },
            options: {
              responsive: true, maintainAspectRatio: false, cutout: '60%',
              plugins: {
                legend: { position: 'bottom', labels: { color: '#201e1f', font: { family: 'Poppins', size: 11, weight: '600' }, boxWidth: 12, padding: 10, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: { callbacks: { label: (ctx) => ctx.label + ': ' + formatCurrencyPrivacy(ctx.parsed) } }
              }
            }
          });
        }
      }

      const barsContainer = document.getElementById('statsCategoryBars');
      barsContainer.innerHTML = '';
      if (catEntries.length === 0) {
        barsContainer.innerHTML = '<p class="stats-empty">No hay gastos registrados este mes.</p>';
      } else {
        const maxVal = catEntries[0][1];
        const totalCat = catEntries.reduce((s, e) => s + e[1], 0);
        catEntries.forEach(([name, val]) => {
          const pctBar = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const pctTotal = totalCat > 0 ? (val / totalCat) * 100 : 0;
          const row = document.createElement('div');
          row.className = 'stats-category-bar';
          const amountDisplay = formatCurrencyPrivacyAbs(val);
          const percentDisplay = privacyMode ? '•••' : pctTotal.toFixed(1).replace('.', ',') + '%';
          row.innerHTML = `
            <div class="bar-name">${escapeHtml(name)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${pctBar}%;"></div></div>
            <div class="bar-amount">${amountDisplay}</div>
            <div class="bar-percent">${percentDisplay}</div>
          `;
          barsContainer.appendChild(row);
        });
      }

      const diasEnMes = new Date(statsYear, statsMonth + 1, 0).getDate();
      const porDia = new Array(diasEnMes).fill(0);
      movsMes.forEach(m => {
        if (m.monto < 0) {
          const day = parseInt(m.fecha.slice(8, 10));
          if (day >= 1 && day <= diasEnMes) {
            porDia[day - 1] += Math.abs(m.monto);
          }
        }
      });
      const diasCanvas = document.getElementById('statsChartDias');
      const diasPrivacy = document.getElementById('statsChartDiasPrivacy');
      if (statsChartDiasInstance) { statsChartDiasInstance.destroy(); statsChartDiasInstance = null; }

      if (privacyMode) {
        if (diasCanvas) diasCanvas.style.display = 'none';
        if (diasPrivacy) diasPrivacy.style.display = 'flex';
      } else {
        if (diasCanvas) diasCanvas.style.display = '';
        if (diasPrivacy) diasPrivacy.style.display = 'none';
        const diasLabels = porDia.map((_, i) => String(i + 1));
        statsChartDiasInstance = new Chart(diasCanvas, {
          type: 'bar',
          data: {
            labels: diasLabels,
            datasets: [{
              label: 'Gasto del día',
              data: porDia,
              backgroundColor: daltonicMode ? '#0072B2' : '#e2781f',
              hoverBackgroundColor: daltonicMode ? '#005A8E' : '#b3410e',
              borderRadius: 4,
              maxBarThickness: 24
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => 'Gastado: ' + formatCurrencyPrivacy(ctx.parsed.y) } }
            },
            scales: {
              x: { ticks: { color: '#6c6b5e', font: { family: 'Poppins', size: 9 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
              y: { beginAtZero: true, ticks: { color: '#6c6b5e', font: { family: 'Poppins', size: 10 }, callback: (val) => val + '$' }, grid: { color: 'rgba(0,0,0,0.06)' } }
            }
          }
        });
      }

      const topContainer = document.getElementById('statsTop5');
      topContainer.innerHTML = '';
      const gastos = movsMes
        .filter(m => m.monto < 0)
        .sort((a, b) => a.monto - b.monto)
        .slice(0, 5);

      if (gastos.length === 0) {
        topContainer.innerHTML = '<p class="stats-empty">No hay gastos registrados este mes.</p>';
      } else {
        gastos.forEach(g => {
          const catName = catMap[g.categoriaId] || 'Sin categoría';
          const dateObj = parseLocalDate(g.fecha);
          const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
          const desc = g.descripcion || '(sin descripción)';
          const row = document.createElement('div');
          row.className = 'stats-top-item';
          row.innerHTML = `
            <div class="top-date">${escapeHtml(dateStr)}</div>
            <div class="top-detail">
              <div class="top-cat">${escapeHtml(catName)}</div>
              <div class="top-desc">${escapeHtml(desc)}</div>
            </div>
            <div class="top-amount">${formatCurrencyPrivacyAbs(g.monto)}</div>
          `;
          topContainer.appendChild(row);
        });
      }

      setTimeout(() => {
        if (statsChartDonaInstance) statsChartDonaInstance.resize();
        if (statsChartDiasInstance) statsChartDiasInstance.resize();
      }, 50);
    }

    function updateChart(sums) {
      const ctx = document.getElementById('chartCanvas');
      const placeholder = document.getElementById('chartPrivacyPlaceholder');
      if (!ctx) return;
      if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

      if (privacyMode) {
        ctx.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        return;
      } else {
        ctx.style.display = '';
        if (placeholder) placeholder.style.display = 'none';
      }

      const labels = Object.keys(sums);
      const data = Object.values(sums);
      if (data.length === 0 || data.every(v => v === 0)) {
        chartInstance = new Chart(ctx, {
          type: 'doughnut',
          data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#444'] }] },
          options: { plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });
        return;
      }
      const palette = daltonicMode 
        ? ['#0072B2','#E69F00','#56B4E9','#009E73','#F0E442','#CC79A7','#999999'] 
        : ['#e2781f','#FFB347','#FFD93D','#6BCB77','#4D96FF','#845EC2','#FF6B6B','#00C9A7','#FF9671','#C34A36','#A8E6CF','#DDA0DD','#87CEEB','#F0E68C','#E6A8D7'];
      const colors = labels.map((_, i) => palette[i % palette.length]);
      chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#201e1f', hoverOffset: 10 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#fff', font: { family: 'Poppins', size: 11, weight: '600' }, boxWidth: 14, padding: 14, usePointStyle: true, pointStyle: 'circle' } }
          }
        }
      });
    }

    async function refreshDashboard() {
      const categories = await db.categories.toArray();
      const catMap = {};
      categories.forEach(c => catMap[c.id] = c.nombre);
      
      const sortedCats = [...categories].sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const visibleCats = sortedCats.filter(c => !c.oculta);
      const movements = await db.movements.toArray();
      
      let totalLiquido = 0;
      const sums = {};
      const movementsByCat = {};
      movements.forEach(m => {
        totalLiquido += m.monto;

        if (m.categoriaId && catMap[m.categoriaId]) {
          const catName = catMap[m.categoriaId];
          sums[catName] = (sums[catName] || 0) + m.monto;
          if (!movementsByCat[m.categoriaId]) movementsByCat[m.categoriaId] = [];
          movementsByCat[m.categoriaId].push(m);
        }
      });
      visibleCats.forEach(c => { if (!(c.nombre in sums)) sums[c.nombre] = 0; });

      const listContainer = document.getElementById('categoryList');
      listContainer.innerHTML = '';
      for (const cat of visibleCats) {
        const key = cat.nombre;
        const val = sums[key] || 0;
        const pill = document.createElement('div');
        pill.className = 'category-pill';
        pill.dataset.categoriaId = cat.id;

        const amountDisplay = privacyMode ? '•••••' : formatCurrency(val);

        const catMovs = movementsByCat[cat.id] || [];
        const currentPrefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        let spentThisMonth = 0;
        catMovs.forEach(m => {
            if (m.fecha && m.fecha.startsWith(currentPrefix) && m.monto < 0) {
                spentThisMonth += Math.abs(m.monto);
            }
        });
        const budget = cat.presupuesto || 0;
        const hasBudget = budget > 0;
        const isOverBudget = hasBudget && spentThisMonth > budget;

        if (isOverBudget) {
            pill.style.border = '2px solid #dc3545';
        }

        let budgetHtml = '';
        if (hasBudget && !privacyMode) {
            budgetHtml = `<div class="budget-info" style="font-size: 11px; margin-top: 2px; font-weight: 700; color: ${isOverBudget ? '#dc3545' : '#6c6b5e'};">
                Gastado: ${spentThisMonth.toFixed(2).replace('.', ',')}$ / ${budget.toFixed(2).replace('.', ',')}$ ${isOverBudget ? '⚠️' : ''}
            </div>`;
        }

        const valRounded = Math.round(val * 100) / 100;
        pill.innerHTML = `
          <span class="drag-handle" title="Mantener presionado para mover"><i class="bi bi-chevron-expand"></i></span>
          <div style="display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0;">
            <span class="name">${key}</span>
            ${budgetHtml}
          </div>
          <span class="amount ${valRounded >= 0 ? 'positive' : 'negative'}">${amountDisplay}</span>
        `;
        listContainer.appendChild(pill);
      }
      if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
      if (listContainer.children.length > 1) {
        sortableInstance = new Sortable(listContainer, {
          animation: 150,
          handle: '.drag-handle',
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          delayOnTouchOnly: 0,
          touchStartThreshold: 3,
          onEnd: async function(evt) {
            const items = listContainer.querySelectorAll('.category-pill');
            const ids = [];
            items.forEach(item => {
              const id = parseInt(item.dataset.categoriaId);
              if (!isNaN(id) && id !== 0) ids.push(id);
            });
            for (let i = 0; i < ids.length; i++) { await db.categories.update(ids[i], { orden: i }); }
            await refreshDashboard();
            scheduleSync();
          }
        });
      }
      
      const pendingLoans = await db.loans.where('estado').equals('pendiente').toArray();
      let totalPorCobrar = 0;
      let totalPorPagar = 0;
      
      pendingLoans.forEach(l => {
        if (l.tipo === 'deuda') {
          totalPorPagar += l.monto;
        } else {
          totalPorCobrar += l.monto;
        }
      });
      
      const netWorth = totalLiquido + totalPorCobrar - totalPorPagar;
      
      document.getElementById('liquidBalance').textContent = formatCurrencyPrivacy(totalLiquido);
      document.getElementById('totalReceivable').textContent = formatCurrencyPrivacyAbs(totalPorCobrar);
      document.getElementById('totalPayable').textContent = formatCurrencyPrivacyAbs(totalPorPagar);
      document.getElementById('netWorth').textContent = formatCurrencyPrivacy(netWorth);
      
      await renderAccountsWithVerification(movements);
      updateChart(sums);
    }
    async function renderAccountsWithVerification(movements) {
      const accounts = await db.accounts.toArray();
      const container = document.getElementById('accountBalances');
      container.innerHTML = '';
      let totalCalculado = 0;
      let totalReal = 0;
      let totalVerificadas = 0;
      
      for (const acc of accounts) {
        const balance = movements.reduce((sum, m) => m.cuenta === acc.nombre ? sum + m.monto : sum, 0);
        totalCalculado += balance;

        let statusClass = 'sin-verificar';
        let statusText = 'Sin verificar';
        let statusTitle = 'El saldo real no ha sido verificado';
        let diff = 0;
        if (acc.saldoReal !== null && acc.saldoReal !== undefined) {
          diff = Math.round((acc.saldoReal - balance) * 100) / 100;
          if (diff === 0) { statusClass = 'igual'; statusText = '✅ Verificado'; statusTitle = 'El saldo real coincide con el calculado'; }
          else if (diff < 0) { statusClass = 'falta'; statusText = `❌ Falta ${formatCurrencyAbs(diff)}`; statusTitle = 'El saldo real es menor al calculado'; }
          else { statusClass = 'sobra'; statusText = `⚠️ Sobra ${formatCurrencyAbs(diff)}`; statusTitle = 'El saldo real es mayor al calculado'; }
          totalReal += acc.saldoReal;
          totalVerificadas++;
        } else { totalReal += balance; }
        
        const realValueReal = (acc.saldoReal !== null && acc.saldoReal !== undefined) ? formatCurrency(acc.saldoReal) : formatCurrency(0);
        const realValueDisplay = privacyMode ? '•••••' : realValueReal;
        const balanceDisplay = formatCurrencyPrivacy(balance);
        
        const card = document.createElement('div');
        card.className = 'account-card';
        card.dataset.accountId = acc.id;
        const statusTextFinal = privacyMode ? (statusClass === 'igual' ? '✅ Verificado' : '•••••') : statusText;
        const statusTitleFinal = privacyMode ? 'Estado oculto por privacidad' : statusTitle;
        
        const pillAttrs = `title="${statusTitleFinal}"`;
        const hiddenText = `<span class="visually-hidden">${statusTitleFinal}</span>`;

        card.innerHTML = `
          <div class="account-name">${acc.nombre}</div>
          <div class="account-balance">${balanceDisplay}</div>
          <div class="divider"></div>
          <div class="real-label">EXISTENCIA REAL</div>
          <div class="real-value ${privacyMode ? 'privacy-locked' : ''}" data-account-id="${acc.id}" data-current-value="${acc.saldoReal !== null ? acc.saldoReal : ''}">
            ${realValueDisplay}
          </div>
          <div class="status-pill ${statusClass}" ${pillAttrs}>
            ${statusTextFinal}
            ${hiddenText}
          </div>
        `;
        container.appendChild(card);
        const realValueEl = card.querySelector('.real-value');
        realValueEl.addEventListener('click', function(e) {
          e.stopPropagation();
          if (privacyMode) return;
          if (this.querySelector('input')) return;
          const parentEl = this;
          const accountId = parseInt(parentEl.dataset.accountId);
          const currentValue = parentEl.dataset.currentValue || '';
          const input = document.createElement('input');
          input.type = 'number'; input.step = '0.01'; input.value = currentValue; input.placeholder = '0,00';
          parentEl.innerHTML = ''; parentEl.appendChild(input); input.focus(); input.select();
          let cancelSave = false;
          const save = () => {
            const val = parseFloat(input.value);
            const newVal = isNaN(val) ? null : val;
            parentEl.dataset.currentValue = newVal !== null ? String(newVal) : '';
            saveRealBalance(accountId, newVal);
            parentEl.innerHTML = newVal !== null ? formatCurrency(newVal) : formatCurrency(0);
            refreshDashboard(); scheduleSync();
          };
          input.addEventListener('blur', () => {
            if (cancelSave) return;
            save();
          });
          input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelSave = true;
              const val = parentEl.dataset.currentValue;
              parentEl.innerHTML = (val !== '' && val !== undefined) ? formatCurrency(parseFloat(val)) : formatCurrency(0);
            }
          });
        });
      }
      const totalContainer = document.getElementById('verificationTotalContainer');
      if (totalVerificadas > 0) {
        const diffTotal = Math.round((totalReal - totalCalculado) * 100) / 100;
        let diffClass = '', diffText = '', diffTitle = '';
        if (diffTotal === 0) { diffClass = 'igual'; diffText = '✅ Verificado'; diffTitle = 'El saldo real coincide con el calculado'; }
        else if (diffTotal < 0) { diffClass = 'falta'; diffText = `❌ Falta ${formatCurrencyAbs(diffTotal)}`; diffTitle = 'El saldo real es menor al calculado'; }
        else { diffClass = 'sobra'; diffText = `⚠️ Sobra ${formatCurrencyAbs(diffTotal)}`; diffTitle = 'El saldo real es mayor al calculado'; }
        
        const totalAttrs = `title="${diffTitle}"`;
        const hiddenTotalText = `<span class="visually-hidden">${diffTitle}</span>`;

        if (privacyMode) {
          const privacyDiffText = (diffClass === 'igual') ? '✅ Verificado' : '•••••';
          totalContainer.innerHTML = `
            <div class="verification-total">
              <div style="display:flex; flex-direction:column; gap:6px;">
                <div><span class="label">Total calculado</span><div class="value">•••••</div></div>
                <div><span class="label">Total real</span><div class="value">•••••</div></div>
              </div>
              <div class="comparison ${diffClass}" title="Estado oculto por privacidad">
                ${privacyDiffText}
                <span class="visually-hidden">Estado oculto por privacidad</span>
              </div>
              <div class="fecha-verif" style="margin-top:4px; font-size:11px; color:#6c6b5e;">${totalVerificadas} cuenta(s) verificada(s)</div>
            </div>
          `;
        } else {
          totalContainer.innerHTML = `
            <div class="verification-total">
              <div style="display:flex; flex-direction:column; gap:6px;">
                <div><span class="label">Total calculado</span><div class="value">${formatCurrency(totalCalculado)}</div></div>
                <div><span class="label">Total real</span><div class="value">${formatCurrency(totalReal)}</div></div>
              </div>
              <div class="comparison ${diffClass}" ${totalAttrs}>
                ${diffText}
                ${hiddenTotalText}
              </div>
              <div class="fecha-verif" style="margin-top:4px; font-size:11px; color:#6c6b5e;">${totalVerificadas} cuenta(s) verificada(s)</div>
            </div>
          `;
        }
      } else { totalContainer.innerHTML = ''; }
    }
    async function saveRealBalance(accountId, newValue) {
      await db.accounts.update(accountId, {
        saldoReal: newValue,
        fechaVerificacion: newValue !== null ? getTodayLocal() : null
      });
    }

    function buildMovementCard(m, catMap) {
      const catName = catMap[m.categoriaId] || 'Sin categoría';
      const sign = m.monto >= 0 ? 'positive' : 'negative';
      const tipoColor = m.monto >= 0 ? 'ingreso' : 'egreso';

      const pill = document.createElement('div');
      pill.className = 'movement-pill' + (tipoColor ? ' ' + tipoColor : '');
      let grupoBadge = '';
      if (m.grupoId) {
        if (m.grupoId.startsWith('redondeo_')) {
          grupoBadge = `<span class="split-badge" title="Redondeo entre categorías"><i class="bi bi-arrow-left-right"></i> Redondeo</span>`;
        } else if (m.grupoId.startsWith('intercambio_')) {
          grupoBadge = `<span class="split-badge" title="Intercambio entre categorías y cuentas"><i class="bi bi-shuffle"></i> Intercambio</span>`;
        } else {
          grupoBadge = `<span class="split-badge" title="Movimiento dividido"><i class="bi bi-distribute-horizontal"></i> Dividido</span>`;
        }
      }

      pill.innerHTML = `
        <div class="movement-header">
          <div class="movement-who">
            <span class="cat">${catName}</span>
            ${m.cuenta ? `<span class="account-badge">${m.cuenta}</span>` : ''}
            ${grupoBadge}
          </div>
          <span class="amount ${sign}">${formatCurrencyPrivacy(m.monto)}</span>
        </div>
        ${m.descripcion ? `<div class="movement-desc">${m.descripcion}</div>` : ''}
        <div class="movement-footer">
          <div class="actions">
            <button class="btn-icon" onclick="editMovement(${m.id})" title="Editar movimiento" aria-label="Editar movimiento"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon danger" onclick="deleteMovement(${m.id})" title="Eliminar movimiento" aria-label="Eliminar movimiento"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      `;
      return pill;
    }

    function buildMovementGroup(grupoId, movs, catMap) {
      const wrapper = document.createElement('div');
      wrapper.className = 'movement-group';
      wrapper.dataset.grupoId = grupoId;
      if (expandedGroups.has(grupoId)) wrapper.classList.add('expanded');

      const firstMov = movs[0];
      const sameAccount = movs.every(m => m.cuenta === firstMov.cuenta);
      const sameDesc = movs.every(m => (m.descripcion || '') === (firstMov.descripcion || ''));
      const catName = catMap[firstMov.categoriaId] || 'Sin categoría';

      let tipoLabel = 'Grupo', tipoClass = '';
      if (grupoId.startsWith('split_')) {
        tipoLabel = 'Dividido'; tipoClass = 'tipo-dividido';
      } else if (grupoId.startsWith('redondeo_')) {
        tipoLabel = 'Redondeo'; tipoClass = 'tipo-redondeo';
      } else if (grupoId.startsWith('intercambio_')) {
        tipoLabel = 'Intercambio'; tipoClass = 'tipo-intercambio';
      }

      wrapper.classList.add(tipoClass);

      let amountStr, amountClass;
      if (grupoId.startsWith('redondeo_') || grupoId.startsWith('intercambio_')) {
        amountStr = formatCurrencyPrivacy(firstMov.monto);
        amountClass = firstMov.monto >= 0 ? 'positive' : 'negative';
      } else {
        const total = movs.reduce((s, m) => s + m.monto, 0);
        amountStr = formatCurrencyPrivacy(total);
        amountClass = total >= 0 ? 'positive' : 'negative';
      }

      let tipoIcon = 'bi-distribute-horizontal';
      if (grupoId.startsWith('redondeo_')) tipoIcon = 'bi-arrow-left-right';
      else if (grupoId.startsWith('intercambio_')) tipoIcon = 'bi-shuffle';

      const parent = document.createElement('div');
      parent.className = `movement-pill group-parent ${tipoClass}`;
      parent.innerHTML = `
        <div class="movement-header">
          <div class="movement-who">
            <span class="cat">${catName}</span>
            ${sameAccount && firstMov.cuenta ? `<span class="account-badge">${firstMov.cuenta}</span>` : ''}
            <span class="split-badge"><i class="bi ${tipoIcon}"></i> ${tipoLabel}</span>
          </div>
          <span class="amount ${amountClass}">${amountStr}</span>
        </div>
        ${sameDesc && firstMov.descripcion ? `<div class="movement-desc">${firstMov.descripcion}</div>` : ''}
        <div class="movement-footer">
          <div class="actions">
            <button class="btn-icon" onclick="editGroupDescription('${grupoId}')" title="Editar descripción del grupo" aria-label="Editar descripción del grupo"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon danger" onclick="deleteGroup('${grupoId}')" title="Eliminar todo el grupo" aria-label="Eliminar todo el grupo"><i class="bi bi-trash"></i></button>
            <button class="btn-icon group-chevron" onclick="toggleGroup('${grupoId}')" title="Ver detalles" aria-label="Expandir detalles del grupo"><i class="bi bi-chevron-down"></i></button>
          </div>
        </div>
      `;
      wrapper.appendChild(parent);

      const children = document.createElement('div');
      children.className = 'movement-group-children';
      for (const m of movs) children.appendChild(buildMovementCard(m, catMap));
      wrapper.appendChild(children);
      return wrapper;
    }

    function toggleGroup(grupoId) {
      const el = document.querySelector(`.movement-group[data-grupo-id="${grupoId}"]`);
      if (expandedGroups.has(grupoId)) {
        expandedGroups.delete(grupoId);
        if (el) el.classList.remove('expanded');
      } else {
        expandedGroups.add(grupoId);
        if (el) el.classList.add('expanded');
      }
    }
    async function deleteGroup(grupoId) {
      if (!confirm('¿Eliminar TODOS los movimientos de este grupo? Esta acción no se puede deshacer.')) return;
      const movs = await db.movements.where('grupoId').equals(grupoId).toArray();
      for (const m of movs) await db.movements.delete(m.id);
      expandedGroups.delete(grupoId);
      await refreshAll(); scheduleSync();
    }
    async function editGroupDescription(grupoId) {
      const movs = await db.movements.where('grupoId').equals(grupoId).toArray();
      if (movs.length === 0) return;
      const currentDesc = movs[0].descripcion || '';
      const newDesc = prompt('Nueva descripción para todos los movimientos del grupo:', currentDesc);
      if (newDesc === null) return;
      for (const m of movs) await db.movements.update(m.id, { descripcion: newDesc });
      await refreshAll(); scheduleSync();
    }

    async function refreshMovements() {
      const filterType = document.getElementById('filterType').value;
      const filterCategory = document.getElementById('filterCategory').value;
      const filterAccount = document.getElementById('filterAccount').value;
      const filterSearch = document.getElementById('filterSearch').value.trim().toLowerCase();
      let movements = await db.movements.toArray();
      movements = movements.map(m => {
        if (typeof m.fecha !== 'string') {
          const d = new Date(m.fecha);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            m.fecha = `${y}-${mo}-${day}`;
            db.movements.update(m.id, { fecha: m.fecha }).catch(() => {});
          } else m.fecha = getTodayLocal();
        }
        return m;
      });
      if (filterType === 'ingreso') movements = movements.filter(m => m.monto > 0);
      else if (filterType === 'egreso') movements = movements.filter(m => m.monto < 0);
      if (filterCategory !== 'all') {
        const catId = parseInt(filterCategory);
        movements = movements.filter(m => m.categoriaId === catId);
      }
      if (filterAccount !== 'all') movements = movements.filter(m => m.cuenta === filterAccount);
      if (!showAllMovements) {
        const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        movements = movements.filter(m => m.fecha.startsWith(prefix));
      }
      if (filterSearch) movements = movements.filter(m => (m.descripcion || '').toLowerCase().includes(filterSearch));
      movements.sort((a, b) => {
        const cmpFecha = b.fecha.localeCompare(a.fecha);
        if (cmpFecha !== 0) return cmpFecha;
        return (b.id || 0) - (a.id || 0);
      });

      const categories = await db.categories.toArray();
      const catMap = {};
      categories.forEach(c => catMap[c.id] = c.nombre);

      const container = document.getElementById('movementsList');
      container.innerHTML = '';
      if (movements.length === 0) {
        container.innerHTML = '<p class="text-light-50">No hay movimientos que coincidan con los filtros.</p>';
        return;
      }
      const byDate = {};
      movements.forEach(m => { if (!byDate[m.fecha]) byDate[m.fecha] = []; byDate[m.fecha].push(m); });
      const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

      for (const dateStr of sortedDates) {
        const dateObj = parseLocalDate(dateStr);
        const displayDate = formatDateLocal(dateObj).toUpperCase();
        const header = document.createElement('div');
        header.className = 'text-white-50 fw-bold mt-3 mb-2';
        header.textContent = displayDate;
        container.appendChild(header);

        const items = byDate[dateStr];
        const groupsMap = {};
        const renderOrder = [];
        items.forEach(m => {
          if (m.grupoId) {
            if (!groupsMap[m.grupoId]) { groupsMap[m.grupoId] = []; renderOrder.push({ type: 'group', id: m.grupoId }); }
            groupsMap[m.grupoId].push(m);
          } else {
            renderOrder.push({ type: 'single', mov: m });
          }
        });
        for (const entry of renderOrder) {
          if (entry.type === 'single') {
            container.appendChild(buildMovementCard(entry.mov, catMap));
          } else {
            const movs = groupsMap[entry.id];
            if (movs.length === 1) {
              container.appendChild(buildMovementCard(movs[0], catMap));
            } else {
              container.appendChild(buildMovementGroup(entry.id, movs, catMap));
            }
          }
        }
      }
    }

    function updateMonthLabel() {
      const date = new Date(currentYear, currentMonth);
      document.getElementById('currentMonthLabel').textContent = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    function toggleShowAll() {
      showAllMovements = !showAllMovements;
      const btn = document.getElementById('showAllBtn');
      if (showAllMovements) {
        btn.textContent = 'Mostrar mes'; btn.classList.add('active');
        document.getElementById('prevMonthBtn').style.display = 'none';
        document.getElementById('nextMonthBtn').style.display = 'none';
        document.getElementById('currentMonthLabel').style.display = 'none';
      } else {
        btn.textContent = 'Ver todos'; btn.classList.remove('active');
        document.getElementById('prevMonthBtn').style.display = 'inline-block';
        document.getElementById('nextMonthBtn').style.display = 'inline-block';
        document.getElementById('currentMonthLabel').style.display = 'inline';
        const now = new Date();
        currentMonth = now.getMonth(); currentYear = now.getFullYear();
        updateMonthLabel();
      }
      applyFilters();
    }
    function changeMonth(delta) {
      if (showAllMovements) return;
      currentMonth += delta;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      updateMonthLabel(); applyFilters();
    }

    function updatePaidMonthLabel() {
      const date = new Date(paidYear, paidMonth);
      document.getElementById('paidMonthLabel').textContent = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }

    function changePaidMonth(delta) {
      paidMonth += delta;
      if (paidMonth < 0) { paidMonth = 11; paidYear--; }
      if (paidMonth > 11) { paidMonth = 0; paidYear++; }
      updatePaidMonthLabel();
      refreshLoans();
    }

    function openMovementsCalendar() {
      const now = new Date();
      const input = document.createElement('input');
      input.type = 'month';
      input.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '-9999px';
      document.body.appendChild(input);
      input.focus();
      input.onchange = () => {
        const parts = input.value.split('-');
        currentYear = parseInt(parts[0], 10);
        currentMonth = parseInt(parts[1], 10) - 1;
        updateMonthLabel(); applyFilters();
        document.body.removeChild(input);
      };
      input.onblur = () => { document.body.removeChild(input); };
      input.click();
    }

    function openPaidLoansCalendar() {
      const now = new Date();
      const input = document.createElement('input');
      input.type = 'month';
      input.value = `${paidYear}-${String(paidMonth + 1).padStart(2, '0')}`;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '-9999px';
      document.body.appendChild(input);
      input.focus();
      input.onchange = () => {
        const parts = input.value.split('-');
        paidYear = parseInt(parts[0], 10);
        paidMonth = parseInt(parts[1], 10) - 1;
        updatePaidMonthLabel();
        refreshLoans();
        document.body.removeChild(input);
      };
      input.onblur = () => { document.body.removeChild(input); };
      input.click();
    }
    function applyFilters() { refreshMovements(); }
    function clearFilters() {
      document.getElementById('filterType').value = 'all';
      document.getElementById('filterCategory').value = 'all';
      document.getElementById('filterAccount').value = 'all';
      document.getElementById('filterSearch').value = '';
      refreshMovements();
    }
    function openAddMovement() {
      document.getElementById('movementForm').reset();
      document.getElementById('editMovementId').value = '';
      document.getElementById('movementModalTitle').textContent = 'Nuevo Movimiento';
      document.getElementById('movementDate').value = getTodayLocal();
      refreshCategoriesDropdown();
      refreshAccountsDropdown('movementAccount');
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('movementModal')).show();
    }
    async function editMovement(id) {
      const m = await db.movements.get(id);
      if (!m) return;
      document.getElementById('editMovementId').value = m.id;
      document.getElementById('movementModalTitle').textContent = 'Editar Movimiento';
      document.getElementById('movementDate').value = m.fecha;
      document.getElementById('movementAmount').value = Math.abs(m.monto);
      document.getElementById('movementDescription').value = m.descripcion || '';
      if (m.monto >= 0) document.getElementById('typeIngreso').checked = true;
      else document.getElementById('typeEgreso').checked = true;
      await refreshCategoriesDropdown();
      document.getElementById('movementCategory').value = m.categoriaId || '';
      renderCselLabel(document.getElementById('movementCategory'));
      await refreshAccountsDropdown('movementAccount');
      document.getElementById('movementAccount').value = m.cuenta || '';
      updateMovementFeedback();
      new bootstrap.Modal(document.getElementById('movementModal')).show();
    }
    async function saveMovement() {
      const editId = document.getElementById('editMovementId').value;
      const fecha = document.getElementById('movementDate').value;
      const categoriaId = parseInt(document.getElementById('movementCategory').value);
      let monto = parseFloat(document.getElementById('movementAmount').value);
      const tipo = document.querySelector('input[name="movementType"]:checked').value;
      const cuenta = document.getElementById('movementAccount').value;
      const descripcion = document.getElementById('movementDescription').value;
      if (!fecha || isNaN(categoriaId) || isNaN(monto) || monto <= 0) { alert('Completa todos los campos obligatorios.'); return; }
      const montoFinal = tipo === 'egreso' ? -monto : monto;
      if (editId) await db.movements.update(parseInt(editId), { fecha, categoriaId, monto: montoFinal, descripcion, cuenta });
      else await db.movements.add({ fecha, categoriaId, monto: montoFinal, descripcion, cuenta });
      bootstrap.Modal.getInstance(document.getElementById('movementModal')).hide();
      await refreshAll(); scheduleSync();
    }
    async function deleteMovement(id) {
      if (!confirm('¿Eliminar este movimiento?')) return;
      await db.movements.delete(id);
      await refreshAll(); scheduleSync();
    }

    let splitLineCounter = 0;
    function openAddSplitMovement() {
      document.getElementById('splitMovementForm').reset();
      document.getElementById('splitDate').value = getTodayLocal();
      document.getElementById('splitLinesContainer').innerHTML = '';
      splitLineCounter = 0;
      refreshAccountsDropdown('splitAccount').then(() => {
        addSplitLine(); addSplitLine(); updateSplitTotals();
        new bootstrap.Modal(document.getElementById('splitMovementModal')).show();
      });
    }
    async function addSplitLine() {
      const id = splitLineCounter++;
      const container = document.getElementById('splitLinesContainer');
      const div = document.createElement('div');
      div.className = 'row align-items-center mb-2 split-line';
      div.dataset.lineId = id;
      div.innerHTML = `
        <div class="col-6"><select class="form-select split-line-category" onchange="updateSplitTotals()"></select></div>
        <div class="col-5"><input type="number" class="form-control split-line-amount" step="0.01" placeholder="Monto" oninput="updateSplitTotals()" /></div>
        <div class="col-1"><button type="button" class="btn-icon danger" onclick="removeSplitLine(${id})" aria-label="Eliminar línea"><i class="bi bi-trash"></i></button></div>
      `;
      container.appendChild(div);
      const categories = await db.categories.toArray();
      const visibles = categories.filter(c => !c.oculta).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const balancesMap = await getCategoryBalancesMap();
      const select = div.querySelector('.split-line-category');
      select.innerHTML = '<option value="">Seleccionar categoría</option>';
      visibles.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = categoryOptionText(c, balancesMap);
        select.appendChild(opt);
      });
      enhanceCategorySelect(select);
      updateSplitTotals();
    }
    function removeSplitLine(id) {
      const line = document.querySelector(`.split-line[data-line-id="${id}"]`);
      if (line) line.remove();
      updateSplitTotals();
    }
    function updateSplitTotals() {
      const total = parseFloat(document.getElementById('splitTotalAmount').value) || 0;
      const lines = document.querySelectorAll('.split-line');
      let assigned = 0;
      lines.forEach(line => { assigned += parseFloat(line.querySelector('.split-line-amount').value) || 0; });
      const remaining = Math.round((total - assigned) * 100) / 100;
      document.getElementById('splitTotalDisplay').textContent = `$${total.toFixed(2)}`;
      document.getElementById('splitAssignedDisplay').textContent = `$${assigned.toFixed(2)}`;
      const remainingEl = document.getElementById('splitRemainingDisplay');
      remainingEl.textContent = `$${remaining.toFixed(2)}`;
      remainingEl.style.color = remaining === 0 ? '#28a745' : '#dc3545';
      const validLines = Array.from(lines).filter(line => {
        const cat = line.querySelector('.split-line-category').value;
        const amt = parseFloat(line.querySelector('.split-line-amount').value) || 0;
        return cat && amt > 0;
      });
      document.getElementById('splitSaveBtn').disabled = !(remaining === 0 && total > 0 && validLines.length >= 2 && validLines.length === lines.length);
    }
    async function saveSplitMovement() {
      const fecha = document.getElementById('splitDate').value;
      const tipo = document.querySelector('input[name="splitType"]:checked').value;
      const cuenta = document.getElementById('splitAccount').value;
      const descripcionGeneral = document.getElementById('splitDescription').value;
      const lines = document.querySelectorAll('.split-line');
      if (!fecha) { alert('La fecha es obligatoria.'); return; }
      const grupoId = `split_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const registros = [];
      for (const line of lines) {
        const categoriaId = parseInt(line.querySelector('.split-line-category').value);
        const monto = parseFloat(line.querySelector('.split-line-amount').value);
        if (isNaN(categoriaId) || isNaN(monto) || monto <= 0) continue;
        const montoFinal = tipo === 'egreso' ? -monto : monto;
        registros.push({ fecha, categoriaId, monto: montoFinal, descripcion: descripcionGeneral, cuenta, grupoId });
      }
      if (registros.length < 2) { alert('Debes repartir el monto en al menos 2 categorías.'); return; }
      await db.movements.bulkAdd(registros);
      expandedGroups.add(grupoId);
      bootstrap.Modal.getInstance(document.getElementById('splitMovementModal')).hide();
      await refreshAll(); scheduleSync();
    }

    function openAddRedondeo() {
      document.getElementById('redondeoForm').reset();
      document.getElementById('redondeoDate').value = getTodayLocal();
      refreshRedondeoCategoryDropdowns();
      refreshAccountsDropdown('redondeoAccount').then(() => {
        checkFormValidity();
        new bootstrap.Modal(document.getElementById('redondeoModal')).show();
      });
    }
    async function refreshRedondeoCategoryDropdowns() {
      const categories = await db.categories.toArray();
      const visibles = categories.filter(c => !c.oculta).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const balancesMap = await getCategoryBalancesMap();
      ['redondeoCategoriaOrigen', 'redondeoCategoriaDestino'].forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        visibles.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id; opt.textContent = categoryOptionText(c, balancesMap);
          select.appendChild(opt);
        });
        enhanceCategorySelect(select);
      });
    }
    async function saveRedondeo() {
      const fecha = document.getElementById('redondeoDate').value;
      const monto = parseFloat(document.getElementById('redondeoAmount').value);
      const categoriaOrigenId = parseInt(document.getElementById('redondeoCategoriaOrigen').value);
      const categoriaDestinoId = parseInt(document.getElementById('redondeoCategoriaDestino').value);
      const cuenta = document.getElementById('redondeoAccount').value;
      if (!fecha || isNaN(monto) || monto <= 0 || isNaN(categoriaOrigenId) || isNaN(categoriaDestinoId)) {
        alert('Completa todos los campos obligatorios con un monto mayor a 0.'); return;
      }
      if (categoriaOrigenId === categoriaDestinoId) { alert('La categoría origen y la categoría destino deben ser distintas.'); return; }
      const grupoId = `redondeo_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await db.movements.bulkAdd([
        { fecha, categoriaId: categoriaOrigenId, monto: -monto, descripcion: 'REDONDEO', cuenta, grupoId },
        { fecha, categoriaId: categoriaDestinoId, monto: monto, descripcion: 'REDONDEO', cuenta, grupoId }
      ]);
      expandedGroups.add(grupoId);
      bootstrap.Modal.getInstance(document.getElementById('redondeoModal')).hide();
      await refreshAll(); scheduleSync();
    }

    async function refreshIntercambioDropdowns() {
      const categories = await db.categories.toArray();
      const visibles = categories.filter(c => !c.oculta).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const balancesMap = await getCategoryBalancesMap();
      ['intercambioCatA', 'intercambioCatB'].forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        visibles.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id; opt.textContent = categoryOptionText(c, balancesMap);
          select.appendChild(opt);
        });
        enhanceCategorySelect(select);
      });
      const accounts = await db.accounts.toArray();
      ['intercambioCuentaA', 'intercambioCuentaB'].forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        accounts.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.nombre; opt.textContent = a.nombre;
          select.appendChild(opt);
        });
      });
    }

    function updateIntercambioUI() {
      document.querySelectorAll('.intercambio-step').forEach(step => step.classList.remove('active'));
      const currentStepEl = document.getElementById(`step-${currentIntercambioStep}-intercambio`);
      if (currentStepEl) currentStepEl.classList.add('active');

      const btnAtras = document.getElementById('btn-intercambio-atras');
      const btnSiguiente = document.getElementById('btn-intercambio-siguiente');
      const btnGuardar = document.getElementById('btn-intercambio-guardar');

      if (currentIntercambioStep === 1) {
        btnAtras.style.display = 'none';
        btnSiguiente.style.display = 'inline-block';
        btnGuardar.style.display = 'none';
        checkIntercambioStepValidity();
      } else if (currentIntercambioStep === 2) {
        btnAtras.style.display = 'inline-block';
        btnSiguiente.style.display = 'inline-block';
        btnGuardar.style.display = 'none';
        checkIntercambioStepValidity();
      } else if (currentIntercambioStep === 3) {
        btnAtras.style.display = 'inline-block';
        btnSiguiente.style.display = 'none';
        btnGuardar.style.display = 'inline-block';
      }
    }

    function nextIntercambioStep() {
      if (currentIntercambioStep === 1) {
        currentIntercambioStep = 2;
      } else if (currentIntercambioStep === 2) {
        const amount = parseFloat(document.getElementById('intercambioAmount').value).toFixed(2).replace('.', ',');
        const catAName = document.getElementById('intercambioCatA').options[document.getElementById('intercambioCatA').selectedIndex].text.split(' —')[0];
        const catBName = document.getElementById('intercambioCatB').options[document.getElementById('intercambioCatB').selectedIndex].text.split(' —')[0];
        const accAName = document.getElementById('intercambioCuentaA').value;
        const accBName = document.getElementById('intercambioCuentaB').value;

        document.getElementById('intercambioSummaryText').innerHTML = `
          Moverás <strong>$${amount}</strong> desde<br>
          <strong>${catAName} / ${accAName}</strong><br>
          hacia<br>
          <strong>${catBName} / ${accBName}</strong>
        `;
        currentIntercambioStep = 3;
      }
      updateIntercambioUI();
    }

    function prevIntercambioStep() {
      if (currentIntercambioStep > 1) {
        currentIntercambioStep--;
        updateIntercambioUI();
      }
    }

    function openAddIntercambio() {
      document.getElementById('intercambioForm').reset();
      document.getElementById('intercambioDate').value = getTodayLocal();
      currentIntercambioStep = 1;
      updateIntercambioUI();
      refreshIntercambioDropdowns().then(() => {
        checkIntercambioStepValidity();
        new bootstrap.Modal(document.getElementById('intercambioModal')).show();
      });
    }

    async function saveIntercambio() {
      const fecha = document.getElementById('intercambioDate').value;
      const monto = parseFloat(document.getElementById('intercambioAmount').value);
      const catAId = parseInt(document.getElementById('intercambioCatA').value);
      const cuentaA = document.getElementById('intercambioCuentaA').value;
      const catBId = parseInt(document.getElementById('intercambioCatB').value);
      const cuentaB = document.getElementById('intercambioCuentaB').value;
      const desc = document.getElementById('intercambioDesc').value.trim();
      
      if (!fecha || isNaN(monto) || monto <= 0) { alert('Revisa la fecha y el monto.'); return; }
      if (isNaN(catAId) || isNaN(catBId)) { alert('Selecciona ambas categorías.'); return; }
      if (!cuentaA || !cuentaB) { alert('Selecciona ambas cuentas.'); return; }
      if (catAId === catBId && cuentaA === cuentaB) { alert('Los lados A y B son iguales, no hay intercambio.'); return; }
      
      const grupoId = `intercambio_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const descFinal = desc || 'INTERCAMBIO';
      
      await db.movements.bulkAdd([
        { fecha, categoriaId: catAId, monto: -monto, descripcion: descFinal, cuenta: cuentaA, grupoId },
        { fecha, categoriaId: catBId, monto: monto, descripcion: descFinal, cuenta: cuentaA, grupoId },
        { fecha, categoriaId: catBId, monto: -monto, descripcion: descFinal, cuenta: cuentaB, grupoId },
        { fecha, categoriaId: catAId, monto: monto, descripcion: descFinal, cuenta: cuentaB, grupoId }
      ]);
      
      expandedGroups.add(grupoId);
      bootstrap.Modal.getInstance(document.getElementById('intercambioModal')).hide();
      await refreshAll(); scheduleSync();
    }

    async function refreshPersonTotals() {
      const container = document.getElementById('personTotalsList');
      if (!container) return;
      const pending = await db.loans.where('estado').equals('pendiente').toArray();
      const byPerson = {};
      pending.forEach(l => {
        const key = l.persona;
        if (!byPerson[key]) byPerson[key] = { total: 0, count: 0, tipo: l.tipo };
        byPerson[key].total += l.monto;
        byPerson[key].count++;
      });
      const names = Object.keys(byPerson).sort((a, b) => byPerson[b].total - byPerson[a].total);
      container.innerHTML = '';
      if (names.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-light-50 mb-0">No hay préstamos pendientes.</p></div>';
        return;
      }
      for (const name of names) {
        const info = byPerson[name];
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        const totalDisplay = formatCurrencyPrivacyAbs(info.total);
        col.innerHTML = `
          <div class="person-total-card">
            <div class="person-name">${escapeHtml(name)}</div>
            <div class="person-total">${escapeHtml(totalDisplay)}</div>
            <div class="person-count">${info.count} préstamo${info.count !== 1 ? 's' : ''} pendiente${info.count !== 1 ? 's' : ''}</div>
            <button class="btn-pdf" type="button" aria-label="Compartir PDF de ${escapeHtml(name)}">
              <i class="bi bi-whatsapp"></i> Compartir PDF
            </button>
          </div>
        `;
        col.querySelector('.btn-pdf').addEventListener('click', function() {
          exportPersonPDF(name, this);
        });
        container.appendChild(col);
      }
    }

    async function getLogoBase64() {
      if (logoBase64Cache) return logoBase64Cache;
      try {
        const resp = await fetch('logo-vicel.png');
        if (!resp.ok) return null;
        const blob = await resp.blob();
        logoBase64Cache = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return logoBase64Cache;
      } catch (e) {
        console.warn('No se pudo cargar el logo para el PDF:', e);
        return null;
      }
    }

    async function exportPersonPDF(personName, btnEl) {
      const originalBtnHtml = btnEl ? btnEl.innerHTML : null;
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '<i class="bi bi-hourglass-split"></i> Generando...';
      }
      try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
          throw new Error('La librería PDF aún se está cargando. Espera 5 segundos y vuelve a intentar.');
        }
        const pending = await db.loans.where('estado').equals('pendiente').toArray();
        const personLoans = pending.filter(l => l.persona === personName);
        if (personLoans.length === 0) {
          alert('No hay préstamos pendientes para ' + personName);
          return;
        }
        personLoans.sort((a, b) => a.fecha.localeCompare(b.fecha));
        const movements = await db.movements.toArray();
        const movMap = {};
        movements.forEach(m => { movMap[m.id] = m; });
        const total = personLoans.reduce((s, l) => s + l.monto, 0);
        const today = new Date();
        const todayStr = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;
        const logo = await getLogoBase64();
        if (logo) {
          try {
            const logoWidth = 55;
            const logoHeight = logoWidth / (1200 / 520);
            doc.addImage(logo, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight);
            y += logoHeight + 3;
          } catch (e) { console.warn('Error al añadir logo:', e); }
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(32, 30, 31);
        doc.text('ESTADO DE CUENTA', pageWidth / 2, y + 6, { align: 'center' });
        y += 12;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text('PRÉSTAMOS PENDIENTES', pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.setDrawColor(226, 120, 31);
        doc.setLineWidth(0.8);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
        doc.setTextColor(32, 30, 31);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Persona:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(personName, margin + 22, y);
        y += 5.5;
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha de emisión:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(todayStr, margin + 38, y);
        y += 5.5;
        doc.setFont('helvetica', 'bold');
        doc.text('Cantidad de préstamos:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personLoans.length), margin + 48, y);
        y += 10;
        const colFecha = margin + 2;
        const colDesc = margin + 30;
        const colCta = margin + 138;
        const colMonto = pageWidth - margin - 2;
        doc.setFillColor(242, 237, 224);
        doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(32, 30, 31);
        doc.text('FECHA', colFecha, y + 4.7);
        doc.text('DESCRIPCIÓN', colDesc, y + 4.7);
        doc.text('CUENTA', colCta, y + 4.7);
        doc.text('MONTO', colMonto, y + 4.7, { align: 'right' });
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const rowHeight = 6.5;
        const truncar = (txt, max) => {
          if (!txt) return '—';
          const t = String(txt);
          return t.length > max ? t.substring(0, max - 1) + '…' : t;
        };
        for (const loan of personLoans) {
          if (y + rowHeight > pageHeight - 30) { doc.addPage(); y = margin; }
          const dateObj = parseLocalDate(loan.fecha);
          const dateStr = dateObj.toLocaleDateString('es-ES');
          const mov = loan.movimientoCreacionId ? movMap[loan.movimientoCreacionId] : null;
          const cuenta = (mov && mov.cuenta) ? mov.cuenta : '—';
          const desc = loan.descripcion || ('Préstamo a ' + loan.persona);
          doc.setTextColor(32, 30, 31);
          doc.text(dateStr, colFecha, y + 4.5);
          doc.text(truncar(desc, 68), colDesc, y + 4.5);
          doc.text(truncar(cuenta, 20), colCta, y + 4.5);
          doc.text(formatCurrencyAbs(loan.monto), colMonto, y + 4.5, { align: 'right' });
          doc.setDrawColor(210, 210, 210);
          doc.setLineWidth(0.1);
          doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
          y += rowHeight;
        }
        if (y + 10 > pageHeight - 25) { doc.addPage(); y = margin; }
        doc.setFillColor(255, 247, 224);
        doc.rect(margin, y, pageWidth - margin * 2, 9, 'F');
        doc.setDrawColor(226, 120, 31);
        doc.setLineWidth(0.6);
        doc.line(margin, y, pageWidth - margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(32, 30, 31);
        doc.text('TOTAL PENDIENTE', colMonto - 32, y + 6.5, { align: 'right' });
        doc.text(formatCurrencyAbs(total), colMonto, y + 6.5, { align: 'right' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Documento generado por VICEL Finanzas · ' + todayStr, pageWidth / 2, pageHeight - 10, { align: 'center' });
        const ymd = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
        const cleanName = personName.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ0-9]/g, '_');
        const filename = `${ymd}_VICEL_PRÉSTAMO_${cleanName}_PDF.pdf`;
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobileDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Estado de cuenta - ${personName}`,
              text: `Estado de cuenta de préstamos pendientes de ${personName}`
            });
            return;
          } catch (shareErr) {
            if (shareErr && shareErr.name === 'AbortError') return;
            console.warn('No se pudo compartir, se descargará el archivo:', shareErr);
          }
        }
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
      } catch (e) {
        console.error('Error al exportar PDF:', e);
        alert('Error al generar el PDF: ' + (e && e.message ? e.message : e));
      } finally {
        if (btnEl && originalBtnHtml !== null) {
          btnEl.disabled = false;
          btnEl.innerHTML = originalBtnHtml;
        }
      }
    }

    async function refreshLoans() {
      const searchEl = document.getElementById('loanSearchPerson');
      const searchPerson = searchEl ? searchEl.value.trim().toLowerCase() : '';
      let pending = await db.loans.where('estado').equals('pendiente').toArray();
      let paid = await db.loans.where('estado').equals('pagado').toArray();
      if (searchPerson) {
        pending = pending.filter(l => l.persona.toLowerCase().includes(searchPerson));
        paid = paid.filter(l => l.persona.toLowerCase().includes(searchPerson));
      }
      pending.sort((a, b) => b.fecha.localeCompare(a.fecha));
      paid.sort((a, b) => b.fecha.localeCompare(a.fecha));
      const movements = await db.movements.toArray();
      const movMap = {};
      movements.forEach(m => { movMap[m.id] = m; });
      const categories = await db.categories.toArray();
      const catMap = {};
      categories.forEach(c => { catMap[c.id] = c.nombre; });

      const buildLoanPillHtml = (loan, isPending) => {
        const dateObj = parseLocalDate(loan.fecha);
        const dateStr = dateObj.toLocaleDateString();
        const mov = loan.movimientoCreacionId ? movMap[loan.movimientoCreacionId] : null;
        let catName = 'Sin categoría';
        if (mov && mov.categoriaId && catMap[mov.categoriaId]) catName = catMap[mov.categoriaId];

        let tipoLabel = loan.tipo === 'deuda' ? 'Yo debo' : 'Me deben';
        let tipoBadgeClass = loan.tipo === 'deuda' ? 'background:#dc3545;' : 'background:#28a745;';

        return `
          <div class="loan-pill">
            <div class="loan-header">
              <div class="loan-who">
                <span class="person">${loan.persona}</span>
                <span class="account-badge" title="Tipo de préstamo" style="color:#fff; ${tipoBadgeClass}">${tipoLabel}</span>
                <span class="account-badge" title="Categoría de origen">${catName}</span>
              </div>
              <span class="amount">${formatCurrencyPrivacyAbs(loan.monto)}</span>
            </div>
            ${loan.descripcion ? `<div class="loan-desc">${loan.descripcion}</div>` : ''}
            <div class="loan-footer">
              <span class="date">${dateStr}</span>
              <div class="actions">
                <button class="btn-icon" onclick="editLoan(${loan.id})" title="Editar préstamo" aria-label="Editar préstamo"><i class="bi bi-pencil"></i></button>
                <button class="btn-icon danger" onclick="deleteLoan(${loan.id})" title="Eliminar préstamo" aria-label="Eliminar préstamo"><i class="bi bi-trash"></i></button>
                ${isPending ? `<button class="btn-icon success" onclick="openPayLoan(${loan.id})" title="Marcar como pagado" aria-label="Marcar como pagado"><i class="bi bi-check-lg"></i></button>` :
                             `<button class="btn-icon primary" onclick="revertLoanPaid(${loan.id})" title="Revertir a pendiente" aria-label="Revertir a pendiente"><i class="bi bi-arrow-counterclockwise"></i></button>`}
              </div>
            </div>
          </div>
        `;
      };

      const renderList = (containerId, items, isPending) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        if (items.length === 0) { container.innerHTML = '<p class="text-light-50">No hay registros.</p>'; return; }
        container.innerHTML = items.map(loan => buildLoanPillHtml(loan, isPending)).join('');
      };

      const renderPaidByMonth = (containerId, items) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        const prefix = `${paidYear}-${String(paidMonth + 1).padStart(2, '0')}`;
        const monthLoans = items.filter(l => l.fecha.startsWith(prefix));
        if (monthLoans.length === 0) { container.innerHTML = '<p class="text-light-50">No hay registros en este mes.</p>'; return; }
        const total = monthLoans.reduce((s, l) => s + l.monto, 0);
        container.innerHTML = `
          <div class="loan-month-total-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span style="font-weight:600;">Total ${new Date(paidYear, paidMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}:</span>
            <span style="font-weight:800; font-size:18px;">${formatCurrencyPrivacyAbs(total)}</span>
          </div>
          <div class="row g-3">
            ${monthLoans.map(loan => buildLoanPillHtml(loan, false)).join('')}
          </div>
        `;
      };

      renderList('pendingLoansList', pending, true);
      renderPaidByMonth('paidLoansList', paid);
    }
    function openAddLoan() {
      document.getElementById('loanForm').reset();
      document.getElementById('loanDate').value = getTodayLocal();
      document.querySelectorAll('.loan-toggle-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('btn-loan-cobro').classList.add('active');
      document.getElementById('loanTypeCobro').checked = true;
      
      refreshCategoriesDropdownForLoan();
      refreshAccountsDropdownForLoan();
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('loanModal')).show();
    }
    async function refreshCategoriesDropdownForLoan() {
      const categories = await db.categories.toArray();
      const visibles = categories.filter(c => !c.oculta).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const balancesMap = await getCategoryBalancesMap();
      const select = document.getElementById('loanCategory');
      select.innerHTML = '<option value="" disabled selected>Seleccionar categoría</option>';
      visibles.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = categoryOptionText(c, balancesMap);
        select.appendChild(opt);
      });
      enhanceCategorySelect(select);
    }
    async function saveLoan() {
      const persona = document.getElementById('loanPerson').value.trim();
      const monto = parseFloat(document.getElementById('loanAmount').value);
      const fecha = document.getElementById('loanDate').value;
      const categoriaRaw = document.getElementById('loanCategory').value;
      const categoriaId = parseInt(categoriaRaw);
      const cuenta = document.getElementById('loanAccount').value;
      const descripcion = document.getElementById('loanDescription').value;
      const tipo = document.querySelector('input[name="loanType"]:checked').value;
      
      if (!persona || isNaN(monto) || monto <= 0 || !fecha || !cuenta) { alert('Completa todos los campos obligatorios.'); return; }
      if (!categoriaId || isNaN(categoriaId)) { alert('Debes seleccionar una categoría para el préstamo.'); return; }
      
      const movMonto = tipo === 'deuda' ? monto : -monto;
      const movDesc = descripcion || (tipo === 'deuda' ? `Préstamo de ${persona}` : `Préstamo a ${persona}`);
      
      const movId = await db.movements.add({ fecha, categoriaId, monto: movMonto, descripcion: movDesc, cuenta });
      
      await db.loans.add({
        persona, monto, fecha, descripcion, estado: 'pendiente',
        fechaPago: null, cuentaPago: null, movimientoCreacionId: movId, movimientoPagoId: null, tipo
      });
      
      bootstrap.Modal.getInstance(document.getElementById('loanModal')).hide();
      await refreshAll(); scheduleSync();
    }
    async function editLoan(id) {
      const loan = await db.loans.get(id);
      if (!loan) return;
      const mov = loan.movimientoCreacionId ? await db.movements.get(loan.movimientoCreacionId) : null;
      document.getElementById('editLoanId').value = loan.id;
      document.getElementById('editLoanPerson').value = loan.persona;
      document.getElementById('editLoanDate').value = loan.fecha;
      document.getElementById('editLoanDescription').value = loan.descripcion || '';
      document.getElementById('editLoanAmountLabel').textContent = formatCurrencyAbs(loan.monto);
      document.getElementById('editLoanTipoLabel').textContent = loan.tipo === 'deuda' ? 'Yo debo' : 'Me deben';
      await refreshAccountsDropdown('editLoanAccount');
      document.getElementById('editLoanAccount').value = mov ? (mov.cuenta || '') : '';
      if (mov && mov.categoriaId) {
        const cat = await db.categories.get(mov.categoriaId);
        document.getElementById('editLoanCategoryLabel').textContent = cat ? cat.nombre : '(categoría desconocida)';
      } else {
        document.getElementById('editLoanCategoryLabel').textContent = 'Sin categoría';
      }
      new bootstrap.Modal(document.getElementById('editLoanModal')).show();
    }
    async function saveLoanEdit() {
      const id = parseInt(document.getElementById('editLoanId').value);
      const persona = document.getElementById('editLoanPerson').value.trim();
      const fecha = document.getElementById('editLoanDate').value;
      const cuenta = document.getElementById('editLoanAccount').value;
      const descripcion = document.getElementById('editLoanDescription').value;
      if (!persona || !fecha || !cuenta) { alert('Completa todos los campos obligatorios.'); return; }
      const loan = await db.loans.get(id);
      if (!loan) return;
      await db.loans.update(id, { persona, fecha, descripcion });
      if (loan.movimientoCreacionId) {
        const movDesc = descripcion || `Préstamo a ${persona}`;
        await db.movements.update(loan.movimientoCreacionId, { fecha, cuenta, descripcion: movDesc });
      }
      bootstrap.Modal.getInstance(document.getElementById('editLoanModal')).hide();
      await refreshAll(); scheduleSync();
    }
    function openPayLoan(loanId) {
      db.loans.get(loanId).then(loan => {
        if (!loan) return;
        db.movements.get(loan.movimientoCreacionId).then(mov => {
          if (!mov) { alert('Error: no se encontró el movimiento de creación del préstamo.'); return; }
          const modal = new bootstrap.Modal(document.getElementById('payLoanModal'));
          document.getElementById('payLoanId').value = loanId;
          document.getElementById('payLoanCategoryId').value = mov.categoriaId || '';
          if (mov.categoriaId) {
            db.categories.get(mov.categoriaId).then(cat => {
              document.getElementById('payLoanCategoryLabel').textContent = cat ? cat.nombre : '(categoría desconocida)';
            });
          } else {
            document.getElementById('payLoanCategoryLabel').textContent = 'Sin categoría (préstamo antiguo)';
          }
          refreshAccountsDropdown('payLoanAccount');
          modal.show();
        });
      });
    }
    async function confirmPayLoan() {
      const loanId = parseInt(document.getElementById('payLoanId').value);
      const cuentaPago = document.getElementById('payLoanAccount').value;
      const categoriaRaw = document.getElementById('payLoanCategoryId').value;
      const categoriaId = categoriaRaw ? parseInt(categoriaRaw) : null;
      if (!cuentaPago) { alert('Debes seleccionar una cuenta.'); return; }
      const loan = await db.loans.get(loanId);
      if (!loan) return;
      
      const movMonto = loan.tipo === 'deuda' ? -loan.monto : loan.monto;
      const movDesc = loan.tipo === 'deuda' ? `Pago de deuda a ${loan.persona}` : `Devolución de préstamo de ${loan.persona}`;
      
      const movId = await db.movements.add({
        fecha: getTodayLocal(), categoriaId: categoriaId, monto: movMonto, descripcion: movDesc, cuenta: cuentaPago
      });
      await db.loans.update(loanId, {
        estado: 'pagado', fechaPago: getTodayLocal(), cuentaPago: cuentaPago, movimientoPagoId: movId
      });
      bootstrap.Modal.getInstance(document.getElementById('payLoanModal')).hide();
      await refreshAll(); scheduleSync();
    }
    async function revertLoanPaid(loanId) {
      if (!confirm('¿Reintegrar este préstamo a Pendientes? Se eliminará el movimiento de pago.')) return;
      const loan = await db.loans.get(loanId);
      if (!loan) return;
      if (loan.movimientoPagoId) await db.movements.delete(loan.movimientoPagoId);
      await db.loans.update(loanId, {
        estado: 'pendiente', fechaPago: null, cuentaPago: null, movimientoPagoId: null
      });
      await refreshAll(); scheduleSync();
    }
    async function deleteLoan(loanId) {
      if (!confirm('¿Eliminar este préstamo? Esta acción no se puede deshacer.')) return;
      const loan = await db.loans.get(loanId);
      if (!loan) return;
      if (loan.estado === 'pendiente') {
        if (loan.movimientoCreacionId) await db.movements.delete(loan.movimientoCreacionId);
      } else if (loan.estado === 'pagado') {
        if (loan.movimientoCreacionId) await db.movements.delete(loan.movimientoCreacionId);
        if (loan.movimientoPagoId) await db.movements.delete(loan.movimientoPagoId);
      }
      await db.loans.delete(loanId);
      await refreshAll(); scheduleSync();
    }

    async function getGoalRemaining(goal) {
      if (goal.lograda) return 0;
      if (!goal.categoriaAnclaId) return goal.costoTotal;
      const movements = await db.movements.where('categoriaId').equals(goal.categoriaAnclaId).toArray();
      const sum = movements.reduce((acc, m) => acc + m.monto, 0);
      let remaining = goal.costoTotal - sum;
      if (remaining < 0) remaining = 0;
      if (remaining > goal.costoTotal) remaining = goal.costoTotal;
      return remaining;
    }
    async function refreshGoals() {
      const goals = await db.goals.toArray();
      const container = document.getElementById('goalsList');
      container.innerHTML = '';
      if (goals.length === 0) { container.innerHTML = '<p class="text-light-50">No hay metas definidas.</p>'; return; }
      for (const goal of goals) {
        const remaining = await getGoalRemaining(goal);
        const progress = goal.lograda ? 100 : ((goal.costoTotal - remaining) / goal.costoTotal) * 100;
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        col.innerHTML = `
          <div class="goal-card">
            <div>
              <div class="title">${goal.nombre}</div>
              <div class="progress-row">
                <span>Meta: ${formatCurrencyPrivacyAbs(goal.costoTotal)}</span>
                <span>${goal.lograda ? '<span class="badge-success">Lograda</span>' : `Restante: ${formatCurrencyPrivacyAbs(remaining)}`}</span>
              </div>
              <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${Math.min(progress,100)}%;"></div></div>
            </div>
            <div class="footer">
              <span>${goal.lograda ? '100%' : Math.round(progress) + '%'}</span>
              <div>
                <button class="btn-icon" onclick="editGoal(${goal.id})" aria-label="Editar meta"><i class="bi bi-pencil"></i></button>
                <button class="btn-icon danger" onclick="deleteGoal(${goal.id})" aria-label="Eliminar meta"><i class="bi bi-trash"></i></button>
                ${!goal.lograda ? `<button class="btn-icon success" onclick="markGoalAchieved(${goal.id})" aria-label="Marcar meta como lograda"><i class="bi bi-check-lg"></i></button>` :
                                  `<button class="btn-icon primary" onclick="revertGoalAchieved(${goal.id})" aria-label="Reactivar meta"><i class="bi bi-arrow-counterclockwise"></i></button>`}
              </div>
            </div>
          </div>
        `;
        container.appendChild(col);
      }
    }
    function openAddGoal() {
      document.getElementById('goalForm').reset();
      document.getElementById('editGoalId').value = '';
      document.getElementById('goalModalTitle').textContent = 'Nueva Meta';
      refreshCategoriesDropdown();
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('goalModal')).show();
    }
    async function editGoal(id) {
      const goal = await db.goals.get(id);
      if (!goal) return;
      document.getElementById('editGoalId').value = goal.id;
      document.getElementById('goalModalTitle').textContent = 'Editar Meta';
      document.getElementById('goalName').value = goal.nombre;
      document.getElementById('goalTotal').value = goal.costoTotal;
      await refreshCategoriesDropdown();
      document.getElementById('goalCategory').value = goal.categoriaAnclaId || '';
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('goalModal')).show();
    }
    async function saveGoal() {
      const editId = document.getElementById('editGoalId').value;
      const nombre = document.getElementById('goalName').value.trim();
      const costoTotal = parseFloat(document.getElementById('goalTotal').value);
      const categoriaAnclaId = parseInt(document.getElementById('goalCategory').value) || null;
      if (!nombre || isNaN(costoTotal) || costoTotal <= 0) { alert('Verifica los datos de la meta.'); return; }
      if (editId) await db.goals.update(parseInt(editId), { nombre, costoTotal, categoriaAnclaId });
      else await db.goals.add({ nombre, costoTotal, categoriaAnclaId, lograda: 0 });
      bootstrap.Modal.getInstance(document.getElementById('goalModal')).hide();
      await refreshAll(); scheduleSync();
    }
    async function markGoalAchieved(id) {
      if (!confirm('¿Marcar esta meta como lograda?')) return;
      await db.goals.update(id, { lograda: 1 });
      await refreshAll(); scheduleSync();
    }
    async function revertGoalAchieved(id) {
      if (!confirm('¿Reactivar esta meta?')) return;
      await db.goals.update(id, { lograda: 0 });
      await refreshAll(); scheduleSync();
    }
    async function deleteGoal(id) {
      if (!confirm('¿Eliminar esta meta?')) return;
      await db.goals.delete(id);
      await refreshAll(); scheduleSync();
    }

    async function refreshCategoriesList() {
      const categories = await db.categories.toArray();
      const container = document.getElementById('categoriesList');
      container.innerHTML = '';
      for (const cat of categories) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        const isHidden = cat.oculta ? true : false;

        col.innerHTML = `
          <div class="category-pill-small">
            <div class="left"><span>${cat.nombre}</span></div>
            <div class="actions">
              <button class="vis-toggle ${isHidden ? 'hidden' : ''}" onclick="toggleCategoryVisibility(${cat.id})" title="${isHidden ? 'Mostrar' : 'Ocultar'}" aria-label="${isHidden ? 'Mostrar categoría' : 'Ocultar categoría'}">
                <i class="bi ${isHidden ? 'bi-eye-slash' : 'bi-eye'}"></i>
              </button>
              <button class="btn-icon" onclick="editCategory(${cat.id})" aria-label="Editar categoría"><i class="bi bi-pencil"></i></button>
              <button class="btn-icon danger" onclick="deleteCategory(${cat.id})" aria-label="Eliminar categoría"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        `;
        container.appendChild(col);
      }
    }
    async function toggleCategoryVisibility(id) {
      if (id === 0) return;
      const cat = await db.categories.get(id);
      if (!cat) return;
      await db.categories.update(id, { oculta: cat.oculta ? 0 : 1 });
      await refreshAll(); scheduleSync();
    }
    async function refreshCategoriesDropdown() {
      const categories = await db.categories.toArray();
      const visibles = categories.filter(c => !c.oculta).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const balancesMap = await getCategoryBalancesMap();
      const select = document.getElementById('movementCategory');
      select.innerHTML = '';
      visibles.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = categoryOptionText(c, balancesMap);
        select.appendChild(opt);
      });
      enhanceCategorySelect(select);

      const goalSelect = document.getElementById('goalCategory');
      if (goalSelect) {
        goalSelect.innerHTML = '<option value="">Ninguna</option>';
        visibles.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id; opt.textContent = c.nombre;
          goalSelect.appendChild(opt);
        });
      }
    }
    function openAddCategory() {
      document.getElementById('categoryForm').reset();
      document.getElementById('categoryEditId').value = '';
      document.getElementById('categoryBudget').value = '';
      document.getElementById('categoryModalTitle').textContent = 'Nueva Categoría';
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('categoryModal')).show();
    }
    async function editCategory(id) {
      const cat = await db.categories.get(id);
      if (!cat) return;
      document.getElementById('categoryName').value = cat.nombre;
      document.getElementById('categoryBudget').value = cat.presupuesto || '';
      document.getElementById('categoryEditId').value = cat.id;
      document.getElementById('categoryModalTitle').textContent = 'Editar Categoría';
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('categoryModal')).show();
    }
    async function saveCategory() {
      const name = document.getElementById('categoryName').value.trim();
      const budgetVal = parseFloat(document.getElementById('categoryBudget').value);
      const presupuesto = isNaN(budgetVal) ? null : budgetVal;
      const editId = document.getElementById('categoryEditId').value;
      if (!name) { alert('El nombre es obligatorio.'); return; }
      if (editId) await db.categories.update(parseInt(editId), { nombre: name, presupuesto });
      else {
        const last = await db.categories.orderBy('orden').last();
        const nuevoOrden = (last && last.orden !== undefined) ? last.orden + 1 : 0;
        await db.categories.add({ nombre: name, esPredeterminado: 0, color: '#E8622C', oculta: 0, orden: nuevoOrden, presupuesto });
      }
      bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
      await refreshAll(); scheduleSync();
    }
    async function deleteCategory(id) {
      const cat = await db.categories.get(id);
      if (!cat) return;
      if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Los movimientos se reasignarán a "Sin categoría".`)) return;
      await db.movements.where('categoriaId').equals(id).modify({ categoriaId: null });
      await db.categories.delete(id);
      await refreshAll(); scheduleSync();
    }

    async function refreshAccountsList() {
      const accounts = await db.accounts.toArray();
      const container = document.getElementById('accountsList');
      container.innerHTML = '';
      for (const acc of accounts) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        col.innerHTML = `
          <div class="account-pill">
            <div class="left">
              <span>${acc.nombre}</span>
            </div>
            <div class="actions">
              <button class="btn-icon" onclick="editAccount(${acc.id})" aria-label="Editar cuenta"><i class="bi bi-pencil"></i></button>
              <button class="btn-icon danger" onclick="deleteAccount(${acc.id})" aria-label="Eliminar cuenta"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        `;
        container.appendChild(col);
      }
    }
    async function refreshAccountsDropdown(selectId) {
      const accounts = await db.accounts.toArray();
      const select = document.getElementById(selectId);
      if (!select) return;
      select.innerHTML = '<option value="">Sin cuenta</option>';
      accounts.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.nombre; opt.textContent = a.nombre;
        select.appendChild(opt);
      });
    }
    async function refreshAccountsDropdownForLoan() {
      const accounts = await db.accounts.toArray();
      const select = document.getElementById('loanAccount');
      if (!select) return;
      select.innerHTML = '';
      accounts.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.nombre; opt.textContent = a.nombre;
        select.appendChild(opt);
      });
    }
    function openAddAccount() {
      document.getElementById('accountForm').reset();
      document.getElementById('accountEditId').value = '';
      document.getElementById('accountModalTitle').textContent = 'Nueva Cuenta';
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('accountModal')).show();
    }
    async function editAccount(id) {
      const acc = await db.accounts.get(id);
      if (!acc) return;
      document.getElementById('accountName').value = acc.nombre;
      document.getElementById('accountEditId').value = acc.id;
      document.getElementById('accountModalTitle').textContent = 'Editar Cuenta';
      checkFormValidity();
      new bootstrap.Modal(document.getElementById('accountModal')).show();
    }
    async function saveAccount() {
      const name = document.getElementById('accountName').value.trim();
      const editId = document.getElementById('accountEditId').value;
      if (!name) { alert('El nombre es obligatorio.'); return; }
      if (editId) {
        const oldName = (await db.accounts.get(parseInt(editId))).nombre;
        await db.accounts.update(parseInt(editId), { nombre: name });
        if (oldName !== name) {
          await db.movements.where('cuenta').equals(oldName).modify({ cuenta: name });
          await db.loans.where('cuentaPago').equals(oldName).modify({ cuentaPago: name });
        }
      } else {
        await db.accounts.add({ nombre: name, saldoReal: null, fechaVerificacion: null });
      }
      bootstrap.Modal.getInstance(document.getElementById('accountModal')).hide();
      await refreshAll(); scheduleSync();
    }
    async function deleteAccount(id) {
      const acc = await db.accounts.get(id);
      if (!acc) return;
      if (!confirm(`¿Eliminar la cuenta "${acc.nombre}"? Los movimientos con esta cuenta se quedarán sin cuenta.`)) return;
      await db.movements.where('cuenta').equals(acc.nombre).modify({ cuenta: null });
      await db.loans.where('cuentaPago').equals(acc.nombre).modify({ cuentaPago: null });
      await db.accounts.delete(id);
      await refreshAll(); scheduleSync();
    }

    async function refreshFilterDropdowns() {
      const categories = await db.categories.toArray();
      const visibles = categories.filter(c => !c.oculta).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const catSelect = document.getElementById('filterCategory');
      if (catSelect) {
        catSelect.innerHTML = '<option value="all">Todas</option>';
        visibles.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id; opt.textContent = c.nombre;
          catSelect.appendChild(opt);
        });
      }
      const accounts = await db.accounts.toArray();
      const accSelect = document.getElementById('filterAccount');
      if (accSelect) {
        accSelect.innerHTML = '<option value="all">Todas</option>';
        accounts.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.nombre; opt.textContent = a.nombre;
          accSelect.appendChild(opt);
        });
      }
    }
    async function refreshEnterprises() {
      const list = document.getElementById('enterprisesList');
      const detail = document.getElementById('enterpriseDetail');
      if (!list) return;
      const enterprises = await db.enterprises.toArray();
      list.innerHTML = '';
      if (enterprises.length === 0) {
        list.innerHTML = '<div class="text-muted text-center py-4">No hay emprendimientos creados. Haz clic en "Nuevo emprendimiento" para empezar.</div>';
        if (detail) detail.innerHTML = '';
        return;
      }
      enterprises.forEach(emp => {
        const card = document.createElement('div');
        card.className = 'enterprise-card card border-0 shadow-sm mb-3';
        card.innerHTML = `
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="card-title mb-1">${escapeHtml(emp.nombre)}</h5>
                <div class="text-muted small">${escapeHtml(emp.producto || 'Sin producto')}</div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" onclick="openEnterpriseForm(${emp.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteEnterprise(${emp.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
              </div>
            </div>
            <hr class="my-2" style="border-color: #eee;">
            <div class="row text-center">
              <div class="col-3"><div class="fw-bold text-primary">${emp.cantidadLote || 0}</div><small class="text-muted">unidades/lote</small></div>
              <div class="col-3"><div class="fw-bold text-success">$${parseFloat(emp.costoUnitarioDolar || 0).toFixed(2)}</div><small class="text-muted">costo unitario</small></div>
              <div class="col-3"><div class="fw-bold">Bs ${parseFloat(emp.precioVentaBs || 0).toLocaleString('es-VE', {minimumFractionDigits:2})}</div><small class="text-muted">precio venta</small></div>
              <div class="col-3"><div class="fw-bold">${parseFloat(emp.tasaBcv || 0).toLocaleString('es-VE', {minimumFractionDigits:2})}</div><small class="text-muted">BCV</small></div>
            </div>
          </div>
        `;
        card.onclick = () => openEnterpriseDetail(emp.id);
        list.appendChild(card);
      });
    }

    async function openEnterpriseDetail(enterpriseId) {
      const emp = await db.enterprises.get(enterpriseId);
      if (!emp) return;
      const debtors = await db.enterprise_debtors.where('enterpriseId').equals(enterpriseId).toArray();
      const detail = document.getElementById('enterpriseDetail');
      if (!detail) return;

      const resultado = calcularEmprendimiento(emp);
      const alertaClase = resultado.margenCosto >= (emp.margenObjetivo || 30) ? 'alert-success' :
        resultado.margenCosto >= (emp.umbralAlerta || 20) ? 'alert-warning' : 'alert-danger';
      const alertaTexto = resultado.margenCosto >= (emp.margenObjetivo || 30) ? 'Zona sana' :
        resultado.margenCosto >= (emp.umbralAlerta || 20) ? 'Atención: margen bajo' : 'Peligro: margen bajo del umbral';

      let deudoresHtml = '';
      if (debtors.length === 0) {
        deudoresHtml = '<div class="text-muted small">No hay deudores registrados.</div>';
      } else {
        deudoresHtml = '<table class="table table-sm table-bordered mt-3"><thead><tr><th>Persona</th><th>Cantidad</th><th>Total a pagar</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';
        debtors.forEach(d => {
          deudoresHtml += `<tr>
            <td>${escapeHtml(d.nombrePersona)}</td>
            <td>${d.cantidadProductos}</td>
            <td>Bs ${parseFloat(d.totalAPagar || 0).toLocaleString('es-VE', {minimumFractionDigits:2})}</td>
            <td><span class="badge ${d.pagado ? 'bg-success' : 'bg-warning'}">${d.pagado ? 'Pagado' : 'Pendiente'}</span></td>
            <td>
              <button class="btn btn-sm btn-${d.pagado ? 'secondary' : 'success'}" onclick="markDebtorPaid(${d.id}, ${!d.pagado})">${d.pagado ? 'Desmarcar' : 'Pagar'}</button>
              <button class="btn btn-sm btn-danger" onclick="deleteDebtor(${d.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        });
        deudoresHtml += '</tbody></table>';
      }

      detail.innerHTML = `
        <div class="enterprise-detail card shadow-sm">
          <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 class="mb-0">${escapeHtml(emp.nombre)}</h5>
            <button class="btn btn-sm btn-outline-secondary" onclick="openEnterpriseForm(${emp.id})"><i class="bi bi-pencil"></i> Editar emprendimiento</button>
          </div>
          <div class="card-body">
            <div class="row mb-4">
              <div class="col-md-6 mb-3">
                <h6>Producto / Lote</h6>
                <p class="fw-bold">${escapeHtml(emp.producto || '—')}</p>
              </div>
              <div class="col-md-6 mb-3">
                <h6>Unidades por lote</h6>
                <p class="fw-bold">${emp.cantidadLote || 0}</p>
              </div>
            </div>
            <div class="${alertaClase} p-3 rounded mb-4">
              <h6 class="mb-2">Estado del margen</h6>
              <p class="mb-1"><strong>${alertaTexto}</strong></p>
              <small class="text-muted">Margen sobre costo: <strong>${resultado.margenCosto.toFixed(2)}%</strong> · Margen bruto: <strong>${resultado.margenBruto.toFixed(2)}%</strong></small>
            </div>
            <div class="row mb-4">
              <div class="col-md-4"><h6>Costo unitario</h6><p class="fw-bold">Bs ${resultado.costoUnitarioBs.toLocaleString('es-VE', {minimumFractionDigits:2})} (${resultado.costoUnitarioDolar.toFixed(2)} $)</p></div>
              <div class="col-md-4"><h6>Costo total lote</h6><p class="fw-bold">Bs ${resultado.costoTotalBs.toLocaleString('es-VE', {minimumFractionDigits:2})} (${resultado.costoTotalDolar.toFixed(2)} $)</p></div>
              <div class="col-md-4"><h6>Ingreso total</h6><p class="fw-bold">Bs ${resultado.ingresoTotalBs.toLocaleString('es-VE', {minimumFractionDigits:2})} (${resultado.ingresoTotalDolar.toFixed(2)} $)</p></div>
            </div>
            <div class="row mb-4">
              <div class="col-md-4"><h6>Ganancia unitaria</h6><p class="fw-bold">Bs ${resultado.gananciaUnitariaBs.toLocaleString('es-VE', {minimumFractionDigits:2})}</p></div>
              <div class="col-md-4"><h6>Ganancia total</h6><p class="fw-bold">Bs ${resultado.gananciaTotalBs.toLocaleString('es-VE', {minimumFractionDigits:2})}</p></div>
              <div class="col-md-4"><h6>Punto de equilibrio</h6><p class="fw-bold">${resultado.puntoEquilibrioUnidades} unidades (Bs ${resultado.puntoEquilibrioBs.toLocaleString('es-VE', {minimumFractionDigits:2})})</p></div>
            </div>
            <div class="alert alert-info mb-4">
              <h6>Precio sugerido según BCV y margen objetivo</h6>
              <p class="fw-bold mb-1">Bs ${resultado.precioSugeridoBs.toLocaleString('es-VE', {minimumFractionDigits:2})}</p>
              <small class="text-muted">Con redondeo comercial: <strong>Bs ${resultado.precioSugeridoRedondeado.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></small>
              <div class="form-check form-switch mt-2">
                <input class="form-check-input" type="checkbox" id="toggleRound${emp.id}" ${emp.redondeoComercial ? 'checked' : ''} onchange="toggleRound(${emp.id}, this.checked)">
                <label class="form-check-label" for="toggleRound${emp.id}">Aplicar redondeo comercial al precio sugerido</label>
              </div>
            </div>

            <h6 class="mt-4 mb-3 border-bottom pb-2">Personas con pago pendiente</h6>
            <div class="debtor-input-row input-group mb-3">
              <input type="text" id="debtorName${emp.id}" class="form-control" placeholder="Nombre de la persona">
              <input type="number" id="debtorQty${emp.id}" class="form-control" placeholder="Cantidad" step="1" min="0">
              <input type="number" id="debtorTotal${emp.id}" class="form-control" placeholder="Total Bs" step="0.01" min="0">
              <button class="btn btn-primary" onclick="saveDebtor(${emp.id})"><i class="bi bi-plus-lg"></i></button>
            </div>
            ${deudoresHtml}
          </div>
        </div>
      `;
    }

    function calcularEmprendimiento(emp) {
      const cantidad = parseFloat(emp.cantidadLote) || 0;
      const costoUsd = parseFloat(emp.costoUnitarioDolar) || 0;
      const precioBs = parseFloat(emp.precioVentaBs) || 0;
      const tasa = parseFloat(emp.tasaBcv) || 0;
      const margenObj = parseFloat(emp.margenObjetivo) || 30;
      const aplicarRedondeo = emp.redondeoComercial === true;

      const costoUnitarioBs = costoUsd * tasa;
      const costoTotalUsd = costoUsd * cantidad;
      const costoTotalBs = costoUnitarioBs * cantidad;
      const ingresoUnitarioUsd = tasa > 0 ? precioBs / tasa : 0;
      const ingresoTotalBs = precioBs * cantidad;
      const ingresoTotalUsd = ingresoUnitarioUsd * cantidad;
      const gananciaUnitariaBs = precioBs - costoUnitarioBs;
      const gananciaTotalBs = ingresoTotalBs - costoTotalBs;
      const margenCosto = costoUnitarioBs > 0 ? (gananciaUnitariaBs / costoUnitarioBs) * 100 : 0;
      const margenBruto = ingresoTotalBs > 0 ? (gananciaTotalBs / ingresoTotalBs) * 100 : 0;
      const puntoEqUnidades = costoUnitarioBs > 0 ? Math.ceil(costoTotalBs / precioBs) : 0;
      const puntoEqBs = puntoEqUnidades * precioBs;

      // Precio sugerido para alcanzar margen objetivo
      let precioSugeridoBs = 0;
      if (costoUnitarioBs > 0) {
        precioSugeridoBs = costoUnitarioBs / (1 - margenObj / 100);
      }
      let precioSugeridoRedondeado = precioSugeridoBs;
      if (aplicarRedondeo) {
        precioSugeridoRedondeado = Math.ceil(precioSugeridoBs / 10) * 10;
      }

      return {
        costoUnitarioBs, costoTotalUsd, costoTotalBs,
        ingresoUnitarioUsd, ingresoTotalBs, ingresoTotalUsd,
        gananciaUnitariaBs, gananciaTotalBs,
        margenCosto, margenBruto,
        puntoEquilibrioUnidades: puntoEqUnidades, puntoEquilibrioBs: puntoEqBs,
        precioSugeridoBs, precioSugeridoRedondeado
      };
    }

    async function saveEnterprise() {
      const id = document.getElementById('entId').value;
      const nombre = document.getElementById('entNombre').value.trim();
      const producto = document.getElementById('entProducto').value.trim();
      const cantidadLote = document.getElementById('entCantidad').value;
      const costoUnitarioDolar = document.getElementById('entCostoUsd').value;
      const precioVentaBs = document.getElementById('entPrecioBs').value;
      const tasaBcv = document.getElementById('entTasa').value;
      const margenObjetivo = document.getElementById('entMargen').value;
      const umbralAlerta = document.getElementById('entUmbral').value;
      const redondeoComercial = document.getElementById('entRedondeo').checked;

      if (!nombre) { alert('El nombre del emprendimiento es obligatorio.'); return; }
      if (!cantidadLote || parseFloat(cantidadLote) <= 0) { alert('La cantidad del lote debe ser mayor a 0.'); return; }
      if (!costoUnitarioDolar || parseFloat(costoUnitarioDolar) <= 0) { alert('El costo unitario debe ser mayor a 0.'); return; }
      if (!precioVentaBs || parseFloat(precioVentaBs) <= 0) { alert('El precio de venta debe ser mayor a 0.'); return; }
      if (!tasaBcv || parseFloat(tasaBcv) <= 0) { alert('La tasa BCV debe ser mayor a 0.'); return; }

      const data = {
        nombre, producto,
        cantidadLote: parseFloat(cantidadLote),
        costoUnitarioDolar: parseFloat(costoUnitarioDolar),
        precioVentaBs: parseFloat(precioVentaBs),
        tasaBcv: parseFloat(tasaBcv),
        margenObjetivo: parseFloat(margenObjetivo),
        umbralAlerta: parseFloat(umbralAlerta),
        redondeoComercial,
        fechaCreacion: new Date().toISOString().slice(0, 10)
      };

      if (id) {
        await db.enterprises.update(parseInt(id), data);
      } else {
        await db.enterprises.add(data);
      }

      bootstrap.Modal.getInstance(document.getElementById('enterpriseModal')).hide();
      await refreshEnterprises();
      showToast('success');
      scheduleSync();
    }

    async function deleteEnterprise(id) {
      if (!confirm('¿Eliminar este emprendimiento? Se borrarán también sus deudores registrados.')) return;
      await db.enterprises.delete(id);
      await db.enterprise_debtors.where('enterpriseId').equals(id).delete();
      await refreshEnterprises();
      showToast('success');
      scheduleSync();
    }

    async function openEnterpriseForm(id = null) {
      const modal = new bootstrap.Modal(document.getElementById('enterpriseModal'));
      const form = document.getElementById('enterpriseForm');
      form.reset();
      document.getElementById('entId').value = '';
      document.getElementById('entRedondeo').checked = false;

      if (id) {
        const emp = await db.enterprises.get(id);
        if (!emp) return;
        document.getElementById('entId').value = emp.id;
        document.getElementById('entNombre').value = emp.nombre;
        document.getElementById('entProducto').value = emp.producto || '';
        document.getElementById('entCantidad').value = emp.cantidadLote || '';
        document.getElementById('entCostoUsd').value = emp.costoUnitarioDolar || '';
        document.getElementById('entPrecioBs').value = emp.precioVentaBs || '';
        document.getElementById('entTasa').value = emp.tasaBcv || '';
        document.getElementById('entMargen').value = emp.margenObjetivo || '';
        document.getElementById('entUmbral').value = emp.umbralAlerta || '';
        document.getElementById('entRedondeo').checked = emp.redondeoComercial === true;
      }

      modal.show();
    }

    async function saveDebtor(enterpriseId) {
      const nombre = document.getElementById(`debtorName${enterpriseId}`).value.trim();
      const cantidad = document.getElementById(`debtorQty${enterpriseId}`).value;
      const total = document.getElementById(`debtorTotal${enterpriseId}`).value;

      if (!nombre) { alert('Ingresa el nombre de la persona.'); return; }
      if (!cantidad || parseInt(cantidad) <= 0) { alert('La cantidad debe ser mayor a 0.'); return; }
      if (!total || parseFloat(total) <= 0) { alert('El total debe ser mayor a 0.'); return; }

      await db.enterprise_debtors.add({
        enterpriseId,
        nombrePersona: nombre,
        cantidadProductos: parseInt(cantidad),
        totalAPagar: parseFloat(total),
        fechaRegistro: new Date().toISOString().slice(0, 10),
        pagado: false
      });

      document.getElementById(`debtorName${enterpriseId}`).value = '';
      document.getElementById(`debtorQty${enterpriseId}`).value = '';
      document.getElementById(`debtorTotal${enterpriseId}`).value = '';

      await openEnterpriseDetail(enterpriseId);
      showToast('success');
      scheduleSync();
    }

    async function deleteDebtor(id) {
      if (!confirm('¿Eliminar este deudor?')) return;
      const debtor = await db.enterprise_debtors.get(id);
      if (!debtor) return;
      await db.enterprise_debtors.delete(id);
      await openEnterpriseDetail(debtor.enterpriseId);
      showToast('success');
      scheduleSync();
    }

    async function markDebtorPaid(id, pagado) {
      await db.enterprise_debtors.update(id, { pagado });
      const debtor = await db.enterprise_debtors.get(id);
      if (debtor) await openEnterpriseDetail(debtor.enterpriseId);
      showToast('success');
      scheduleSync();
    }

    async function toggleRound(enterpriseId, checked) {
      await db.enterprises.update(enterpriseId, { redondeoComercial: checked });
      await openEnterpriseDetail(enterpriseId);
      scheduleSync();
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function setupTabs() {
      document.querySelectorAll('.sidebar .nav .nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.sidebar .nav .nav-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tab = btn.dataset.tab;
          document.querySelectorAll('.main > .tab-content').forEach(el => el.classList.remove('active'));
          const targetTab = document.getElementById(`tab-${tab}`);
          if (targetTab) {
            targetTab.classList.add('active');
          }
          if (tab === 'dashboard') refreshDashboard();
          else if (tab === 'stats') refreshStats();
          else if (tab === 'enterprises') refreshEnterprises();
          document.getElementById('sidebar').classList.remove('open');
          document.getElementById('sidebarOverlay').classList.remove('active');
        });
      });
    }
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => { console.log('✅ Service Worker registrado con éxito. Scope:', registration.scope); })
      .catch(error => { console.warn('⚠️ Error al registrar el Service Worker:', error); });
  });
} else {
  console.log('Este navegador no soporta Service Workers.');
}