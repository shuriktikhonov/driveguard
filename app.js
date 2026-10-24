'use strict';
(() => {
  const purchase = document.querySelector('#purchase-dialog');
  const form = document.querySelector('#contact-form');
  const success = document.querySelector('#contact-success');
  let approvalTimer;
  let requestText = '';
  document.querySelectorAll('[data-open]').forEach(button => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.open);
      if (dialog === purchase) {
        clearTimeout(approvalTimer);
        purchase.classList.remove('approved');
        document.querySelector('#purchase-title').textContent = 'Оформляем подписку…';
        document.querySelector('#purchase-description').textContent = 'Показываем, как будет выглядеть оформление.';
      }
      dialog.showModal();
      document.body.classList.add('dialog-open');
      if (dialog === purchase) {
        approvalTimer = setTimeout(() => {
          purchase.classList.add('approved');
          document.querySelector('#purchase-title').textContent = 'Подписка одобрена';
          document.querySelector('#purchase-description').textContent = 'Готово! Так выглядит успешное оформление ДрайвГард.';
        }, 1100);
      }
    });
  });
  document.querySelectorAll('.action-dialog').forEach(dialog => {
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => {
      if (!document.querySelector('.action-dialog[open]')) document.body.classList.remove('dialog-open');
      if (dialog === purchase && !purchase.open) clearTimeout(approvalTimer);
    });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    for (const input of form.querySelectorAll('input')) {
      input.value = input.value.trim();
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    requestText = `Заявка ДрайвГард\n\nКомпания: ${data.get('company')}\nИмя: ${data.get('name')}\nПочта: ${data.get('email')}\nКомментарий: ${data.get('message').trim() || '—'}\n\nДемонстрация: заявка не отправлена.\n`;
    form.hidden = true;
    success.hidden = false;
    document.querySelector('#download-request').focus();
  });
  document.querySelector('#edit-request').addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    form.elements.company.focus();
  });
  document.querySelector('#download-request').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([requestText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ДрайвГард-заявка.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
