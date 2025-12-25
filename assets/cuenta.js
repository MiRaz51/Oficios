(function () {
  const formRegistro = document.getElementById('frmCuentaRegistro');
  const formLogin = document.getElementById('frmCuentaLogin');
  const btnCrear = document.getElementById('btnCrearCuenta');
  const btnCancelarRegistro = document.getElementById('btnCancelarCuenta');
  const btnLogin = document.getElementById('btnLogin');
  const btnCancelarLogin = document.getElementById('btnCancelarLogin');
  const tabRegistro = document.getElementById('tabRegistro');
  const tabLogin = document.getElementById('tabLogin');
  const mensaje = document.getElementById('cuentaMensaje');
  const passwordError = document.getElementById('cuentaPasswordError');
  const btnOlvidoPassword = document.getElementById('btnOlvidoPassword');
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  const btnTogglePasswordConfirm = document.getElementById('btnTogglePasswordConfirm');
  const btnTogglePasswordLogin = document.getElementById('btnTogglePasswordLogin');
  const btnIrRegistroDesdeLogin = document.getElementById('btnIrRegistroDesdeLogin');
  const loginLinksTop = document.getElementById('loginLinksTop');
  const loginLinksBottom = document.getElementById('loginLinksBottom');
  const registroEmailExisteActions = document.getElementById('registroEmailExisteActions');
  const btnReenviarVerificacion = document.getElementById('btnReenviarVerificacion');
  const btnIrLoginDesdeEmailExiste = document.getElementById('btnIrLoginDesdeEmailExiste');
  const registroPostCreateActions = document.getElementById('registroPostCreateActions');
  const btnIrLoginPostRegistro = document.getElementById('btnIrLoginPostRegistro');

  // Asegurarnos de que los ojos estén ocultos al cargar la página
  if (btnTogglePassword) {
    btnTogglePassword.style.display = 'none';
  }
  if (btnTogglePasswordConfirm) {
    btnTogglePasswordConfirm.style.display = 'none';
  }
  if (btnTogglePasswordLogin) {
    btnTogglePasswordLogin.style.display = 'none';
  }

  const params = new URLSearchParams(window.location.search);
  // cuenta.html está en la carpeta /assets, así que redirigimos a archivos hermanos
  const ret = params.get('return');
  const returnTo = ret === 'publicaciones' ? 'publicaciones.html' : (ret === 'ofertas' ? 'ofertas.html' : 'oficios.html');
  const mode = params.get('mode'); // 'login' o 'registro'

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      let timerId = null;
      timerId = setTimeout(() => reject(new Error('timeout')), ms);
      Promise.resolve(promise)
        .then((v) => {
          if (timerId) clearTimeout(timerId);
          resolve(v);
        })
        .catch((e) => {
          if (timerId) clearTimeout(timerId);
          reject(e);
        });
    });
  }

  // Botón para reenviar correo de verificación cuando el correo ya existe
  if (btnReenviarVerificacion) {
    btnReenviarVerificacion.addEventListener('click', async () => {
      const email = document.getElementById('cuentaEmail')?.value?.trim();
      if (!email) {
        setMensaje('Introduce tu correo electrónico en el formulario para reenviar la verificación.', 'error');
        return;
      }

      btnReenviarVerificacion.disabled = true;
      setMensaje('Enviando un nuevo correo de verificación...', 'info');

      try {
        await pb.collection('users').requestVerification(email);
        setMensaje('Si existe una cuenta pendiente de verificación con ese correo, te hemos enviado un nuevo email.', 'success');
      } catch (err) {
        console.error('[Cuenta] Error reenviando verificación:', err);
        setMensaje('No se pudo reenviar el correo de verificación. Inténtalo de nuevo más tarde.', 'error');
      } finally {
        btnReenviarVerificacion.disabled = false;
      }
    });
  }

  if (btnIrLoginPostRegistro) {
    btnIrLoginPostRegistro.addEventListener('click', () => {
      setModeLogin();

      try {
        const email = document.getElementById('cuentaEmail')?.value?.trim();
        const loginEmail = document.getElementById('loginEmail');
        if (email && loginEmail) {
          loginEmail.value = email;
        }
      } catch (_) {}

      try {
        formLogin?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {}
    });
  }

  function setMensaje(texto, tipo = 'info') {
    if (!mensaje) return;
    mensaje.textContent = texto || '';
    mensaje.className = 'status-message ' + (tipo || 'info');

    // Asegurar que el mensaje se vea (especialmente los de error)
    if (texto) {
      try {
        mensaje.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {
        // scrollIntoView puede no estar disponible en algunos navegadores antiguos
      }
    }

    // Complementar con notificación tipo toast para errores y éxitos
    if (typeof window !== 'undefined' && typeof window.showToast === 'function' && texto) {
      if (tipo === 'error' || tipo === 'success') {
        try {
          window.showToast(texto, tipo);
        } catch (_) {
          // Si falla el toast, no rompemos la UI de mensajes
        }
      }
    }
  }

  function setPasswordError(texto) {
    if (!passwordError) return;
    passwordError.textContent = texto || '';
  }

  function setupPasswordToggle(buttonEl, inputId) {
    if (!buttonEl) return;
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    buttonEl.addEventListener('click', () => {
      const isHidden = inputEl.type === 'password';
      inputEl.type = isHidden ? 'text' : 'password';
      // Usar siempre el mismo icono de ojo y marcar visible con una clase para el estilo de "ojo tachado"
      buttonEl.textContent = '👁';
      if (isHidden) {
        buttonEl.classList.add('is-visible');
      } else {
        buttonEl.classList.remove('is-visible');
      }
    });
  }

  function setModeRegistro() {
    if (tabRegistro) tabRegistro.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
    if (formRegistro) formRegistro.style.display = '';
    if (formLogin) formLogin.style.display = 'none';
    const txtReg = document.getElementById('textoRegistro');
    const txtLog = document.getElementById('textoLogin');
    if (txtReg) txtReg.style.display = '';
    if (txtLog) txtLog.style.display = 'none';
    if (registroEmailExisteActions) registroEmailExisteActions.classList.add('is-hidden');
    if (registroPostCreateActions) registroPostCreateActions.classList.add('is-hidden');
    if (loginLinksTop) loginLinksTop.classList.add('is-hidden');
    if (loginLinksBottom) loginLinksBottom.classList.add('is-hidden');
    if (btnTogglePassword) btnTogglePassword.style.display = 'none';
    if (btnTogglePasswordConfirm) btnTogglePasswordConfirm.style.display = 'none';
    setMensaje('', 'info');
  }

  function setModeLogin() {
    if (tabLogin) tabLogin.classList.add('active');
    if (tabRegistro) tabRegistro.classList.remove('active');
    if (formLogin) formLogin.style.display = '';
    if (formRegistro) formRegistro.style.display = 'none';
    // Asegurar que la contraseña de login se muestre siempre oculta al entrar en este modo
    try {
      const loginPasswordInput = document.getElementById('loginPassword');
      if (loginPasswordInput) {
        loginPasswordInput.type = 'password';
      }
    } catch (_) {}
    const txtReg = document.getElementById('textoRegistro');
    const txtLog = document.getElementById('textoLogin');
    if (txtReg) txtReg.style.display = 'none';
    if (txtLog) txtLog.style.display = '';
    if (registroEmailExisteActions) registroEmailExisteActions.classList.add('is-hidden');
    if (registroPostCreateActions) registroPostCreateActions.classList.add('is-hidden');
    if (loginLinksTop) loginLinksTop.classList.add('is-hidden');
    if (loginLinksBottom) loginLinksBottom.classList.add('is-hidden');
    if (btnTogglePasswordLogin) btnTogglePasswordLogin.style.display = 'none';
    setMensaje('', 'info');
  }

  tabRegistro?.addEventListener('click', setModeRegistro);
  tabLogin?.addEventListener('click', setModeLogin);

  // Inicializar botones de mostrar/ocultar contraseña
  setupPasswordToggle(btnTogglePassword, 'cuentaPassword');
  setupPasswordToggle(btnTogglePasswordConfirm, 'cuentaPasswordConfirm');
  setupPasswordToggle(btnTogglePasswordLogin, 'loginPassword');

  // Botón dentro del formulario de login para ir a crear cuenta
  if (btnIrRegistroDesdeLogin) {
    btnIrRegistroDesdeLogin.addEventListener('click', () => {
      setModeRegistro();
      try {
        formRegistro?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {}
    });
  }

  // Botón que aparece solo cuando el correo ya existe, para pasar a iniciar sesión
  if (btnIrLoginDesdeEmailExiste) {
    btnIrLoginDesdeEmailExiste.addEventListener('click', () => {
      setModeLogin();

      try {
        const email = document.getElementById('cuentaEmail')?.value?.trim();
        const loginEmail = document.getElementById('loginEmail');
        if (email && loginEmail) {
          loginEmail.value = email;
        }
      } catch (_) {}

      try {
        formLogin?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {}
    });
  }

  btnCancelarRegistro?.addEventListener('click', () => {
    window.location.href = returnTo;
  });

  btnCancelarLogin?.addEventListener('click', () => {
    window.location.href = returnTo;
  });

  // Flujo de "¿Has olvidado tu contraseña?"
  if (btnOlvidoPassword) {
    btnOlvidoPassword.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail')?.value.trim();

      if (!email) {
        setMensaje('Introduce tu correo electrónico para poder enviarte las instrucciones de restablecimiento.', 'error');
        return;
      }

      btnOlvidoPassword.disabled = true;
      setMensaje('Enviando instrucciones para restablecer tu contraseña...', 'info');

      try {
        await pb.collection('users').requestPasswordReset(email);
        setMensaje('Si existe una cuenta con ese correo, te hemos enviado un email con instrucciones para restablecer tu contraseña.', 'success');
      } catch (err) {
        console.error('[Cuenta] Error solicitando restablecimiento de contraseña:', err);
        // No exponemos si el correo existe o no, por seguridad
        setMensaje('No se pudo enviar el correo de restablecimiento. Inténtalo de nuevo más tarde.', 'error');
      } finally {
        btnOlvidoPassword.disabled = false;
      }
    });
  }

  formRegistro?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('cuentaNombre').value.trim();
    const whatsappRaw = document.getElementById('cuentaWhatsapp').value.replace(/\D/g, '');
    const email = document.getElementById('cuentaEmail').value.trim();
    const password = document.getElementById('cuentaPassword').value;
    const passwordConfirm = document.getElementById('cuentaPasswordConfirm').value;

    setPasswordError('');

    // Validación de campos obligatorios (excepto email, que se valida aparte)
    if (!nombre || !whatsappRaw || !password || !passwordConfirm) {
      setMensaje('Por favor, completa todos los campos obligatorios.', 'error');
      return;
    }

    // Validación completa de correo: no vacío + formato usuario@dominio.tld
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailPattern.test(email)) {
      setMensaje('Introduce un correo electrónico válido (ejemplo@dominio.com).', 'error');
      return;
    }

    // Validación de contraseña: mínimo 8 caracteres, solo letras y números, con al menos una letra y un número
    const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordPattern.test(password)) {
      const msgPwd = 'La contraseña debe tener al menos 8 caracteres y contener letras y números (solo letras y números).';
      setPasswordError(msgPwd);
      setMensaje(msgPwd, 'error');
      return;
    }

    if (password !== passwordConfirm) {
      setPasswordError('Las contraseñas no coinciden.');
      setMensaje('Las contraseñas no coinciden.', 'error');
      if (btnTogglePassword) btnTogglePassword.style.display = '';
      if (btnTogglePasswordConfirm) btnTogglePasswordConfirm.style.display = '';
      return;
    }

    if (!window.isValidWhatsapp9 || !window.isValidWhatsapp9(whatsappRaw)) {
      setMensaje('El WhatsApp debe tener exactamente 9 dígitos numéricos.', 'error');
      return;
    }

    btnCrear.disabled = true;
    try {
      formRegistro?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Crear usuario en PocketBase y obtener su email efectivo
      const created = await pb.collection('users').create({
        email,
        password,
        passwordConfirm,
        nombre,
        whatsapp: whatsappRaw,
      });

      const createdEmail = created?.email || email;

      // Solicitar a PocketBase que envíe el correo de verificación directamente
      if (createdEmail) {
        try {
          await pb.collection('users').requestVerification(createdEmail);
        } catch (apiErr) {
          console.error('[Cuenta] Error solicitando verificación de correo en PocketBase:', apiErr);
        }
      } else {
        console.error('[Cuenta] Usuario creado sin email válido.');
      }

      setMensaje('Cuenta creada. Revisa tu correo y verifica tu email para poder iniciar sesión.', 'success');
      if (registroPostCreateActions) {
        registroPostCreateActions.classList.remove('is-hidden');
      }
    } catch (err) {
      console.error('[Cuenta] Error creando usuario en PocketBase:', err);

      const emailError = err?.data?.data?.email;
      const whatsappError = err?.data?.data?.whatsapp;

      if (emailError) {
        setMensaje('Ya existe una cuenta con ese correo electrónico. Puedes ir a iniciar sesión o reenviar el correo de verificación.', 'error');
        if (registroEmailExisteActions) {
          registroEmailExisteActions.classList.remove('is-hidden');
        }
      } else if (whatsappError) {
        setMensaje('Ya existe una cuenta asociada a este número de WhatsApp. Usa ese número para iniciar sesión con tu cuenta existente.', 'error');
        if (registroEmailExisteActions) {
          registroEmailExisteActions.classList.remove('is-hidden');
        }
      } else {
        setMensaje('No se pudo crear la cuenta. Revisa que el correo y el número de WhatsApp no estén ya asociados a otra cuenta.', 'error');
      }
    } finally {
      btnCrear.disabled = false;
      btnCrear.textContent = 'Crear cuenta y continuar';
    }
  });

// Botón que aparece solo cuando el correo ya existe, para pasar a iniciar sesión
if (btnIrLoginDesdeEmailExiste) {
  btnIrLoginDesdeEmailExiste.addEventListener('click', () => {
    setModeLogin();

    try {
      const email = document.getElementById('cuentaEmail')?.value?.trim();
      const loginEmail = document.getElementById('loginEmail');
      if (email && loginEmail) {
        loginEmail.value = email;
      }
    } catch (_) {}

    try {
      formLogin?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  });
}

  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      setMensaje('Introduce tu correo y contraseña.', 'error');
      return;
    }

    // Validación de formato de correo igual que en el registro
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      setMensaje('Introduce un correo electrónico válido (ejemplo@dominio.com).', 'error');
      return;
    }

    // Validación de contraseña igual que en el registro: mínimo 8 caracteres, letras y números
    const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordPattern.test(password)) {
      setMensaje('La contraseña debe tener al menos 8 caracteres y contener letras y números (solo letras y números).', 'error');
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando sesión...';
    setMensaje('Iniciando sesión...', 'info');

    try {
      const authData = await withTimeout(pb.collection('users').authWithPassword(email, password), 30000);
      const user = authData?.record;

      if (!user) {
        throw new Error('No se pudo obtener la información del usuario.');
      }

      if (!user.verified) {
        try {
          if (window.pb && window.pb.authStore) {
            window.pb.authStore.clear();
          }
        } catch (_) {}
        setMensaje('Tu correo aún no está verificado. Revisa el enlace de verificación enviado a tu email.', 'error');
        return;
      }

      setMensaje('Sesión iniciada correctamente. Redirigiendo...', 'success');
      window.location.href = returnTo;

    } catch (err) {
      console.error('[Cuenta] Error iniciando sesión:', err);

      if (err && err.message === 'timeout') {
        setMensaje('El servidor está tardando en responder. Puede estar iniciándose. Inténtalo de nuevo en unos segundos.', 'error');
        // En timeout consideramos que también puede ayudar ver la contraseña
        if (btnTogglePasswordLogin) btnTogglePasswordLogin.style.display = '';
        return;
      }

      let msg = err?.message || 'Error desconocido iniciando sesión.';
      if (err?.data?.data) {
        const details = Object.entries(err.data.data)
          .map(([field, e]) => `${field}: ${e.message}`)
          .join('\n');
        if (details) msg += '\n' + details;
      }
      setMensaje(msg, 'error');

      // Mostrar opciones adicionales de ayuda solo tras un fallo real de login
      if (loginLinksTop) loginLinksTop.classList.remove('is-hidden');
      if (loginLinksBottom) loginLinksBottom.classList.remove('is-hidden');
      if (btnTogglePasswordLogin) btnTogglePasswordLogin.style.display = '';
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Iniciar sesión';
    }
  });

  // Modo inicial según parámetro de la URL
  if (mode === 'login') {
    setModeLogin();
  } else {
    setModeRegistro();
  }
})();
