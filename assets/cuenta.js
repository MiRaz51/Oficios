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
  const btnIrRegistroDesdeLogin = document.getElementById('btnIrRegistroDesdeLogin');
  const registroEmailExisteActions = document.getElementById('registroEmailExisteActions');
  const btnIrLoginDesdeEmailExiste = document.getElementById('btnIrLoginDesdeEmailExiste');
  const registroPostCreateActions = document.getElementById('registroPostCreateActions');
  const btnIrLoginPostRegistro = document.getElementById('btnIrLoginPostRegistro');

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
    setMensaje('', 'info');
  }

  function setModeLogin() {
    if (tabLogin) tabLogin.classList.add('active');
    if (tabRegistro) tabRegistro.classList.remove('active');
    if (formLogin) formLogin.style.display = '';
    if (formRegistro) formRegistro.style.display = 'none';
    const txtReg = document.getElementById('textoRegistro');
    const txtLog = document.getElementById('textoLogin');
    if (txtReg) txtReg.style.display = 'none';
    if (txtLog) txtLog.style.display = '';
    if (registroEmailExisteActions) registroEmailExisteActions.classList.add('is-hidden');
    if (registroPostCreateActions) registroPostCreateActions.classList.add('is-hidden');
    setMensaje('', 'info');
  }

  tabRegistro?.addEventListener('click', setModeRegistro);
  tabLogin?.addEventListener('click', setModeLogin);

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

    if (!nombre || !whatsappRaw || !email || !password || !passwordConfirm) {
      setMensaje('Por favor, completa todos los campos obligatorios.', 'error');
      return;
    }

    if (password !== passwordConfirm) {
      setPasswordError('Las contraseñas no coinciden.');
      setMensaje('', 'error');
      return;
    }

    if (!/^[0-9]{9}$/.test(whatsappRaw)) {
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
      setMensaje('No se pudo crear la cuenta. Revisa que el correo y el número de WhatsApp no estén ya asociados a otra cuenta.', 'error');
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
