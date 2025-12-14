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
    btnCrear.textContent = 'Creando cuenta...';
    setMensaje('Creando cuenta...', 'info');

    try {
      // Intentar crear el usuario; los índices únicos de PocketBase evitarán duplicados
      try {
        await pb.collection('users').create({
          email,
          password,
          passwordConfirm,
          nombre,
          whatsapp: whatsappRaw,
        });

        await pb.collection('users').requestVerification(email);
      } catch (createErr) {
        console.error('[Cuenta] Error creando usuario en PocketBase:', createErr);

        let handled = false;

        // Normalizar estructura de error de PocketBase
        const rawData = createErr?.data?.data || createErr?.data || null;
        const status = createErr?.status || createErr?.data?.status || null;

        if (status === 400 && rawData && typeof rawData === 'object') {
          const data = rawData;

          // Recorremos todos los campos devueltos por PocketBase
          for (const [field, info] of Object.entries(data)) {
            const fieldName = String(field).toLowerCase();
            const code = info?.code || '';

            if (fieldName === 'password') {
              setPasswordError('La contraseña debe tener al menos 8 caracteres.');
              setMensaje('', 'error');
              handled = true;
            } else if (fieldName === 'email') {
              // Correo ya registrado: mostrar mensaje y ofrecer botón para ir a Iniciar sesión
              setMensaje('Ya existe una cuenta con ese correo. Cambia a la pestaña de Iniciar sesión para entrar.', 'error');
              handled = true;
            } else if (fieldName === 'whatsapp' || fieldName.includes('whatsapp')) {
              setMensaje('Ya existe una cuenta utilizando ese número de WhatsApp. Usa Iniciar sesión o cambia el número.', 'error');
              handled = true;
            } else if (code === 'validation_not_unique') {
              // Índice único sin nombre de campo claro
              setMensaje('Alguno de los datos ya está asociado a otra cuenta (correo o WhatsApp).', 'error');
              handled = true;
            }
          }

          if (handled) {
            return; // No continuamos ni dejamos que el catch externo sobreescriba el mensaje
          }
        }

        // Si llegamos aquí, no sabemos el detalle exacto, pero NO debemos continuar
        setMensaje('No se pudo crear la cuenta. Revisa que el correo y el número de WhatsApp no estén ya asociados a otra cuenta.', 'error');
        return;
      }

      // Autenticar solo si el usuario se creó correctamente
      await pb.collection('users').authWithPassword(email, password);

      setMensaje('Cuenta creada. Revisa tu correo para verificar tu email. Redirigiendo...', 'success');

      setTimeout(() => {
        window.location.href = returnTo;
      }, 1200);
    } catch (err) {
      console.error('[Cuenta] Error creando o autenticando usuario:', err);
      let msg = err?.message || 'Error desconocido creando la cuenta.';
      if (err?.data?.data) {
        const details = Object.entries(err.data.data)
          .map(([field, e]) => `${field}: ${e.message}`)
          .join('\n');
        if (details) msg += '\n' + details;
      }
      setMensaje(msg, 'error');
    } finally {
      btnCrear.disabled = false;
      btnCrear.textContent = 'Crear cuenta y continuar';
    }
  });

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
