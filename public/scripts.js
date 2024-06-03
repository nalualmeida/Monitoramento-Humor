// LOGOUT

function confirmLogout() {
    if (confirm("Você realmente quer sair?")) {
      window.location.href = "/logout";
    }
  }

// FORMULÁRIO ADDHUMOR

document.getElementById('humorForm').addEventListener('submit', function(event) {
    var dataAtual = document.getElementById('data_atual').value;
    // var avaliacaoHumor = document.querySelector('input[name="avaliacao_humor"]:checked');

    if (!dataAtual) {
        alert("Por favor, selecione uma data para o registro.");
        event.preventDefault();
    }

    // if (!avaliacaoHumor) {
    //     alert("Por favor, nos diga como você está!");
    //     event.preventDefault();
    // }
});

document.addEventListener('DOMContentLoaded', function() {
    var dataAtual = document.getElementById('data_atual');
    var hoje = new Date();
    
    var dia = ("0" + hoje.getDate()).slice(-2);
    var mes = ("0" + (hoje.getMonth() + 1)).slice(-2);
    var ano = hoje.getFullYear();
    
    var dataFormatada = `${ano}-${mes}-${dia}`;
    dataAtual.value = dataFormatada;
    
    // Definir o atributo max para o dia atual
    dataAtual.setAttribute('max', dataFormatada);
});

  let selectedMood = "";
  let selectedEmocoes = [];
  let selectedSono = "";
  let selectedSocial = [];
  let selectedClima = [];

  function selectMood(button) {
    selectedMood = button.innerText;
    document.getElementById("avaliacao_humor").value = selectedMood;
    document.querySelectorAll('.btn-mood').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
  }

  function toggleEmocoes(button) {
    const emocao = button.innerText;
    const index = selectedEmocoes.indexOf(emocao);
    if (index > -1) {
      selectedEmocoes.splice(index, 1);
      button.classList.remove('selected');
    } else {
      selectedEmocoes.push(emocao);
      button.classList.add('selected');
    }
    document.getElementById("emocoes").value = selectedEmocoes.join(', ');
  }

  function selectSono(button) {
    selectedSono = button.innerText;
    document.getElementById("sono").value = selectedSono;
    document.querySelectorAll('.btn-sono').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
  }

  function toggleSocial(button) {
    const social = button.innerText;
    const index = selectedSocial.indexOf(social);
    if (index > -1) {
      selectedSocial.splice(index, 1);
      button.classList.remove('selected');
    } else {
      selectedSocial.push(social);
      button.classList.add('selected');
    }
    document.getElementById("social").value = selectedSocial.join(', ');
  }

  function toggleClima(button) {
    const clima = button.innerText;
    const index = selectedClima.indexOf(clima);
    if (index > -1) {
      selectedClima.splice(index, 1);
      button.classList.remove('selected');
    } else {
      selectedClima.push(clima);
      button.classList.add('selected');
    }
    document.getElementById("clima").value = selectedClima.join(', ');
  }

  let mediaRecorder;
    let audioChunks = [];

    const recordButton = document.getElementById('recordButton');
    const stopButton = document.getElementById('stopButton');
    const audioInput = document.getElementById('audioInput');
    const recordingStatus = document.getElementById('recordingStatus');

    recordButton.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();

        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(audioFile);
            audioInput.files = dataTransfer.files;
        });

        recordButton.disabled = true;
        stopButton.disabled = false;
        recordingStatus.textContent = 'Gravando...';
    });

    stopButton.addEventListener('click', () => {
        mediaRecorder.stop();
        recordButton.disabled = false;
        stopButton.disabled = true;
        recordingStatus.textContent = 'Gravação finalizada.';
    });

    // CALENDARIO

    document.addEventListener('DOMContentLoaded', function() {
        const calendarEl = document.getElementById('calendar');
        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          events: async function(fetchInfo, successCallback, failureCallback) {
            try {
              const response = await axios.get('/humor-dados', {
                params: {
                  startDate: fetchInfo.startStr,
                  endDate: fetchInfo.endStr
                }
              });
    
              const events = response.data.map(entry => ({
                title: `Humor: ${entry.avaliacao_humor}`,
                start: entry.data_atual,
                allDay: true
              }));
    
              successCallback(events);
            } catch (error) {
              failureCallback(error);
            }
          }
        });
    
        calendar.render();
      });

