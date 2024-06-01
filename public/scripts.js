// MODAL SUPORTE
var abrirModal = document.querySelector("#abrirModal")
var fade = document.querySelector("#fade")
var modal = document.querySelector("#modal")
var fechar = document.querySelector('#fechar')

var eventos = [abrirModal,fade,fechar]

let toogleModal = ()=>{
    modal.classList.toggle('hide')
    fade.classList.toggle('hide')
}

eventos.map((el)=>{
    el.addEventListener("click", () => toogleModal())
})

