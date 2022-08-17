function valida_celular() {
    var cel = document.getElementById('celular')
    if (cel.value.length == 1) {
        cel.value = '(' + cel.value
    }
    if (cel.value.length == 3) {
        cel.value += ')'
    }
    if (cel.value.length == 4) {
        cel.value += ' '
    }
    if (cel.value.length == 6) {
        cel.value += ' '
    }
    if (cel.value.length == 11) {
        cel.value += '-'
    }
}

function dia() {
    var html = ''
    var htmloption = ''
    var m
    var mes
    var d
    var dia
    var ano
    var date = new Date()
    m = date.getMonth() + 1
    if (parseFloat(m) < 10) {
        mes = '0' + m
    } else {
        mes = m
    }
    d = date.getDate()
    if (parseFloat(d) < 10) {
        dia = '0' + d
    } else {
        dia = d
    }
    ano = date.getFullYear()
    var data = String(ano) + "-" + String(mes) + "-" + String(dia)
    var htmlabresel = '<div class="row" style="width: 100%"><div class="col"><select name="cliente" class="form-select mt-2">'
    var htmlfechsel = '</select></div>'
    var htmlcliente = '<div class="col-md-1"><a href="/cliente/novo/voltar" style="font-size: 35px;color: rgb(44,55,89)"> + </a></div><div class="col"><input class="form-control mt-2" type="Date" name="data" value=' + data + '></div></div>'
    var htmliniform = '<form action="/gerenciamento/addmanutencao" method="post">'
    var htmlsubmit = '<div class="row" style="width: 100%"><div class="col-md-5 text-start" style="padding-left: 20px"><div class="form-check mt-2"><input class="form-check-input" name="check" type="checkbox""><label class="form-check-label mt-1" style="font-size: 15px;">Sem Cliente</label></div></div><div class="col text-start"><button type="submit" style="border: white 1px solid;margin-top: 10px;margin-bottom: 10px;background-color: green;color: white">Próximo</button></div></div>'
    var htmlfimform = '</form>'
    var clinome = document.getElementsByName('clinome[]')
    var cliid = document.getElementsByName('cliid[]')
    for (i = 0; i < clinome.length; i++) {
        htmloption = htmloption + '<option value="' + cliid[i].value + '">' + clinome[i].value + '</option>'
    }
    html = htmliniform + htmlabresel + htmloption + htmlfechsel + htmlcliente + htmlsubmit + htmlfimform
    //if (clinome.length > 0) {
    Swal.fire({
        title: '<strong style="font-size: 25px">Selecione o cliente</strong>',
        width: 800,
        html: html,
        showCloseButton: true,
        showConfirmButton: false,
    })
    //}
}

function termoEntrega() {
    var html = ''
    var m
    var mes
    var d
    var dia
    var ano
    var date = new Date()
    m = date.getMonth() + 1
    if (parseFloat(m) < 10) {
        mes = '0' + m
    } else {
        mes = m
    }
    d = date.getDate()
    if (parseFloat(d) < 10) {
        dia = '0' + d
    } else {
        dia = d
    }
    ano = date.getFullYear()
    var desctermo = $('#desctermo').val()
    var id = $('#id').val()
    var data = ano + '-' + mes + '-' + dia
    var htmliniform = '<form action="/gerenciamento/salvarImagem" enctype="multipart/form-data" method="post">'
    if (desctermo.length > 0) {
        var htmlsubmit = '<input type="hidden" name="seq" value="0"><input type="hidden" name="idprj" value="' + id + '"><input type="hidden" name="date" value=' + data + '><input type="hidden" name="tipo" value="termo"><input type="file" name="files" class="form-control form-control-sm"><div><button type="submit" class="btn btn-sm btn-success mt-2">Salvar</button><a style="margin-left: 7px" class="btn btn-sm btn-primary mt-2" href="/gerenciamento/mostrarBucket/' + desctermo + '"><i class="d-flex bi bi-eye"></i></a></div>'
    } else {
        var htmlsubmit = '<input type="hidden" name="seq" value="0"><input type="hidden" name="idprj" value="' + id + '"><input type="hidden" name="date" value=' + data + '><input type="hidden" name="tipo" value="termo"><input type="file" name="files" class="form-control form-control-sm"><button type="submit" class="btn btn-sm btn-success mt-2">Salvar</button>'
    }
    var htmlfimform = '</form>'
    html = htmliniform + htmlsubmit + htmlfimform
    Swal.fire({
        title: '<strong style="font-size: 25px">Adicionar o Termo de Entrega</strong>',
        width: 800,
        html: html,
        showCloseButton: true,
        showConfirmButton: false,
    })
}

function fieldValidation(field) {
    const fieldChange = document.getElementById(field)
    if (fieldChange.value != '') {
        fieldChange.className = 'form-control form-control-sm is-valid'
    } else {
        fieldChange.className = 'form-control form-control-sm is-invalid'
    }
}

function novoOrcamento() {

    var selclientes = document.getElementById('selclientes')

    var flex = document.createElement('div')
    flex.style.display = 'flex'
    var cliente = document.createElement('a')
    cliente.href = '/cliente/novo/voltar'
    cliente.className = 'btn btn-sm btn-primary'
    cliente.style.paddingTop = '5px'
    cliente.style.marginLeft = '10px'
    cliente.text = '+ Cliente'
    var botao = document.createElement('button')
    botao.className = 'btn btn-sm btn-success'
    botao.type = 'submit'
    botao.style.marginLeft = '10px'
    botao.textContent = 'Próximo'

    var temcliente = document.getElementsByClassName('temcliente')
    var clinome = document.getElementsByName('clinome[]')
    var cliid = document.getElementsByName('cliid[]')

    if (temcliente.length > 0) {

        var span = document.createElement('br')
        var label = document.createElement('label')
        label.textContent = 'Cliente'
        label.className = 'col-form-label col-form-label-sm'
        label.style.width = '60px'
        var select = document.createElement('select')
        select.className = 'form-select form-select-sm'
        select.name = 'cliente'
        select.style.width = '160px'

        var option = document.createElement('option')
        for (let i = 0; i < clinome.length; i++) {
            option.value = cliid[i].value
            option.text = clinome[i].value
        }

        select.appendChild(option)
        flex.append(span)
        flex.append(label)
        flex.append(select)
        selclientes.append(flex)
        selclientes.append(cliente)
        selclientes.append(botao)

    } else {
        selclientes.append(cliente)
        selclientes.append(botao)
    }
}

function selTipo() {
    var solar = $('#solar').val()
    var camara = $('#camara').val()
    var ar = $('#ar').val()
    var seltipo = document.getElementById('seltipo')

    if ($('#solar').is(':checked')) {
        // alert('solar')
        seltipo.value = 'solar'
    }
    if ($('#camara').is(':checked')) {
        // alert('camara')
        seltipo.value = 'camara'
    }
    if ($('#ar').is(':checked')) {
        // alert('ar')
        seltipo.value = 'ar'
    }
}

function salvarCampos() {
    // alert('entrou')
    var params = document.getElementsByName('params[]')
    var campos = document.getElementById('campos')

    var valores = ''
    var tag
    // alert('params=>'+params)
    for (let i = 0; i < params.length; i++) {
        tag = params[i].tagName
        valores = valores + params[i].value + ';'
    }
    campos.value = valores
    // alert('campos.value=>'+campos.value)

    var desc = document.getElementsByName('desc[]')
    //alert('desc=>'+desc)
    var qtd = document.getElementsByName('qtd[]')
    //alert('qtd=>'+qtd)
    var dados_desc = document.getElementById('dados_desc')
    var dados_qtd = document.getElementById('dados_qtd')

    valores = ''
    for (let i = 0; i < desc.length; i++) {
        valores = valores + desc[i].value + ';'
    }
    //alert('dados_desc=>'+valores)
    dados_desc.value = valores
    valores = ''
    for (let i = 0; i < qtd.length; i++) {
        valores = valores + qtd[i].value + ';'
    }
    //alert('dados_qtd=>'+valores)
    dados_qtd.value = valores
}

function dataCheck(data) {
    var dt = document.getElementById(data)
    dt.value = dataHoje()
}

function setValidade() {
    var ano
    var mes
    var dia
    var novadata
    var date

    var dtcad = document.getElementById('dtcadastro')
    var dtvalida = document.getElementById('dtvalidade')
    novadata = new Date(dtcad.value)
    date = new Date(dtcad.value)

    novadata.setDate(date.getDate() + 7)
    ano = novadata.getFullYear()
    mes = novadata.getMonth()
    dia = novadata.getDate()
    if (dia == 1) {
        mes = mes + 2
    } else {
        mes = mes + 1
    }
    if (mes < 10) {
        mes = '0' + mes
    }
    if (dia < 10) {
        dia = '0' + dia
    }
    dtvalida.value = ano + '-' + mes + '-' + dia
}

function mascara_data() {
    var data = document.getElementById('data')
    var currenTime = new Date()
    var year = currenTime.getFullYear()
    var ano = data.value
    ano1 = ano.substring(3, 7)
    mes1 = ano.substring(0, 2)

    if (data.value.length == 2) {
        data.value += "/"
    }
    if (data.value.length == 7) {
        if (parseFloat(ano1) > parseFloat(year) || parseFloat(ano1) < 1846 || parseFloat(mes1) > 12) {
            data.value = ''
        }
    }
}

function valida_cnpj() {
    var cnpj = document.getElementById('cnpj')

    if (cnpj.value.length == 2 || cnpj.value.length == 6) {
        cnpj.value += '.'
    }
    if (cnpj.value.length == 10) {
        cnpj.value += '/'
    }
    if (cnpj.value.length == 15) {
        cnpj.value += '-'
    }

    if (cnpj.value.length == 18) {

        var d1 = cnpj.value
        var p1 = d1.substring(0, 2)
        var p2 = d1.substring(3, 6)
        var p3 = d1.substring(7, 10)
        var p4 = d1.substring(11, 15)
        var p5 = d1.substring(16, 18)
        var numdoc = p1 + p2 + p3 + p4 + p5

        if (numdoc == "00000000000000" ||
            numdoc == "11111111111111" ||
            numdoc == "22222222222222" ||
            numdoc == "33333333333333" ||
            numdoc == "44444444444444" ||
            numdoc == "55555555555555" ||
            numdoc == "66666666666666" ||
            numdoc == "77777777777777" ||
            numdoc == "88888888888888" ||
            numdoc == "99999999999999") {
            cnpj.value = ''
        }

        // Valida DVs
        var tamanho = numdoc.length - 2
        var numeros = numdoc.substring(0, tamanho)
        var digitos = numdoc.substring(tamanho)
        var soma = 0
        var pos = tamanho - 7;
        for (i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2)
                pos = 9;
        }
        var resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(0)) {
            cnpj.value = ''
        }

        tamanho = tamanho + 1;
        numeros = numdoc.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2)
                pos = 9;
        }
        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(1)) {
            cnpj.value = ''
        }
    }
}

function valida_cpf(numero) {
    var doc = document.getElementById(numero)
    var soma
    var resto

    soma = 0

    if (doc.value.length == 3 || doc.value.length == 7) {
        doc.value += '.'
    }
    if (doc.value.length == 11) {
        doc.value += '-'
    }
    if (doc.value.length == 14) {

        var d1 = doc.value
        var p1 = d1.substring(0, 3)
        var p2 = d1.substring(4, 7)
        var p3 = d1.substring(8, 11)
        var p4 = d1.substring(12, 14)
        var numdoc = p1 + p2 + p3 + p4

        if (numdoc == "00000000000") {
            doc.value = '';
        }

        for (i = 1; i <= 9; i++) {
            soma = soma + parseInt(numdoc.substring(i - 1, i)) * (11 - i);
        }
        resto = (soma * 10) % 11;

        if ((resto == 10) || (resto == 11)) {
            resto = 0;
        }
        if (resto != parseInt(numdoc.substring(9, 10))) {
            doc.value = ''
        }

        soma = 0;
        for (i = 1; i <= 10; i++) {
            soma = soma + parseInt(numdoc.substring(i - 1, i)) * (12 - i)
        }

        resto = (soma * 10) % 11
        if ((resto == 10) || (resto == 11)) {
            resto = 0
        }

        if (resto != parseInt(numdoc.substring(10, 11))) {
            doc.value = ''
        }

    }
}

function responsavel() {
    var res = document.getElementById('responsavel')
    var funins = document.getElementById('funins')
    if (funins.checked) {
        res.style.display = ''
    } else {
        res.style.display = 'none'
    }
}

function editarLocal() {
    var labelCidade = document.getElementById('labelCidade')
    var labelUf = document.getElementById('labelUf')
    var cidade = document.getElementById('cidade')
    var estado = document.getElementById('estado')
    var br0 = document.getElementById('br0')
    var br1 = document.getElementById('br1')
    var altend = document.getElementById('altend')
    var endereco = document.getElementById('endereco')
    var checkLocal = document.getElementById('checkLocal')

    if (checkLocal.checked) {
        labelCidade.style.display = 'none'
        labelUf.style.display = 'none'
        br0.style.display = 'none'
        br1.style.display = 'none'
        cidade.style.display = 'flex'
        estado.style.display = 'flex'
        altend.style.display = 'flex'
        endereco.style.display = 'none'
    } else {
        labelCidade.style.display = 'flex'
        labelUf.style.display = 'flex'
        br0.style.display = 'flex'
        br1.style.display = 'flex'
        cidade.style.display = 'none'
        estado.style.display = 'none'
        altend.style.display = 'none'
        endereco.style.display = 'flex'
    }
}

function documento() {
    var mostraCPF = document.getElementById('mostraCPF')
    var mostraCNPJ = document.getElementById('mostraCNPJ')
    var radioCPF = document.getElementById('radioCPF')
    var radioCNPJ = document.getElementById('radioCNPJ')
    if (radioCPF.checked) {
        mostraCPF.style.display = ''
        mostraCNPJ.style.display = 'none'
    } else {
        mostraCPF.style.display = 'none'
        mostraCNPJ.style.display = ''
    }
}

function novo() {
    var obs = document.getElementById('obs')
    obs.value = ''
}

function select() {
    var select30 = document.getElementById('select30')
    var select45 = document.getElementById('select45')
    var select60 = document.getElementById('select60')
    var dataprazo = document.getElementById('dataprazo')

    if (select30.checked) {
        dataprazo.value = 30
    } else {
        if (select45.checked) {
            dataprazo.value = 45
        } else {
            dataprazo.value = 60
        }
    }
}

function buscaCPF() {
    Swal.fire({
        title: '<strong style="font-size: 25px">Pesquisa de CPF</strong>' + '\n' +
            '<label style="font-size: 15px">Digite o número do CPF do cliente no campo abaixo</label>',
        width: 800,
        html: '<form method="post" action="/cliente/buscaCPF/"><input type="text" id="buscacpf" name="buscacpf" onkeyup="valida_cpf(' + "'" + 'buscacpf' + "'" + ')" class="form-control"><button type="submit" class="btn btn-sm btn-primary mt-2">Pesquisar</button></form>',
        showCloseButton: true,
        showConfirmButton: false,
    })
}

function selecao() {
    var asc = document.getElementById('asc')
    var desc = document.getElementById('desc')
    var ordem = document.getElementById('ordem')
    if (asc.checked) {
        ordem.value = 1
    } else {
        ordem.value = -1
    }
}

function manutencao() {
    var hoje = new Date()
    var ano = hoje.getFullYear()
    var dia = hoje.getDay()
    if (parseFloat(dia) < 10) {
        dia = '0' + dia
    }
    var html = ''
    var htmloption = ''
    var htmlabresel = '<div class="row" style="width: 100%"><div class="col"><select name="cliente" class="form-select mt-2">'
    var htmlfechsel = '</select></div>'
    var htmlcliente = '<div class="col-md-1"><a href="/cliente/novo/voltar" style="font-size: 35px;color: rgb(44,55,89)"> + </a></div></div>'
    var htmliniform = '<form action="/gerenciamento/addmanutencao" method="post">'
    var htmlmeio = '<input type="hidden" name="dia" value="' + String(dia) + '"><input type="hidden" name="ano" value="' + String(ano) + '">'
    var htmlsubmit = '<div class="row" style="width: 100%"><div class="col-md-5 text-start" style="padding-left: 20px"><div class="form-check mt-2"><input class="form-check-input" name="check" type="checkbox""><label class="form-check-label mt-1" style="font-size: 15px;">Sem Cliente</label></div></div><div class="col text-start"><button type="submit" style="border: white 1px solid;margin-top: 10px;margin-bottom: 10px;background-color: green;color: white">Próximo</button></div></div>'
    var htmlfimform = '</form>'
    var clinome = document.getElementsByName('clinome[]')
    var cliid = document.getElementsByName('cliid[]')
    for (i = 0; i < clinome.length; i++) {
        htmloption = htmloption + '<option value="' + cliid[i].value + '">' + clinome[i].value + '</option>'
    }
    html = htmliniform + htmlabresel + htmloption + htmlfechsel + htmlcliente + htmlmeio + htmlsubmit + htmlfimform
    if (clinome.length > 0) {
        Swal.fire({
            title: '<strong style="font-size: 25px">Adicionar Nova Tarefa</strong>' + '\n' +
                '<label style="font-size: 15px">Selecione o cliente para a nova instalação, manutenção ou tarefa.</label>',
            width: 800,
            icon: 'success',
            html: html,
            showCloseButton: true,
            showConfirmButton: false, no
        })
    }
}

function entrarOrcamento(res, id, id_res) {
    var pessoa = document.getElementById('pessoa')
    var id_pes = pessoa.value
    if (res != 'vazio' && String(id_pes) != String(id_res)) {
        var txt_res = 'Orçamentista alocado: ' + res + '.'
        Swal.fire({
            title: 'Deseja continuar?',
            text: txt_res,
            showDenyButton: true,
            confirmButtonText: 'Sim',
            denyButtonText: `Não`,
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = '/gerenciamento/orcamento/' + id
            }
        })
    } else {
        window.location.href = '/gerenciamento/orcamento/' + id
    }
}

function preview_foto() {
    var imagem = document.querySelector('input[name=files]').files[0]
    var preview = document.querySelector('img[name=foto]')
    var salva = document.getElementById('fotosalva')
    var fotoprev = document.getElementById('fotopreview')

    salva.style.display = 'none'
    fotoprev.style.display = ''

    var reader = new FileReader()
    reader.onloadend = function () {
        preview.src = reader.result
    }

    if (imagem) {
        reader.readAsDataURL(imagem)
    } else {
        preview.src = ''
    }
}

function preview_logo() {
    var imagem = document.querySelector('input[name=logo]').files[0]
    var preview = document.querySelector('img[name=foto]')
    var salva = document.getElementById('fotosalva')
    var fotoprev = document.getElementById('fotopreview')

    salva.style.display = 'none'
    fotoprev.style.display = ''

    var reader = new FileReader()
    reader.onloadend = function () {
        preview.src = reader.result
    }

    if (imagem) {
        reader.readAsDataURL(imagem)
    } else {
        preview.src = ''
    }
}

function agendarDash(projeto, cliente, vendedor) {
    Swal.fire({
        title: '<strong style="font-size: 25px">Agendar Contato</strong>' + '\n' +
            '<label style="font-size: 15px">Clique no botão abaixo para confirmar</label>',
        width: 800,
        html: '<form method="post" action="/agenda/adicionar"><input type="hidden" name="voltar" value="dashboard"><input type="hidden" name="id" value="' + projeto + '"><input type="hidden" name="cliente" value="' + cliente + '"><input type="hidden" name="vendedor" value="' + vendedor + '"><div class="row" style="width: 100%"><div class="col"><label class="col-form-label col-form-label-sm">Descrição</label><textarea name="descricao" placeholder: "Descrição da atividade" class="form-control form-control-sm" rows="8"></textarea></div></div><div class="row mt-3 mb-3" style="width: 100%"><div class="col-md-4 text-end"><label class="col-form-label col-form-label-sm">Data e Hora:</label></div><div class="col-md-4 text-start"><input type="datetime-local" class="form-control form-control-sm" name="data"></div><div class="col-md-3"><button type="submit" class="btn btn-sm btn-primary"><i class="bi bi-check"></i></button></div></div></form>',
        showCloseButton: true,
        showConfirmButton: false,
    })
}

function agendar(projeto, cliente, vendedor, data, agenda) {
    var x
    var descricao = document.getElementById('descricao')
    var xagenda
    var xdescricao
    var xdata
    x = descricao.value
    if (x == '') {
        xdescricao = ''
    } else {
        xdescricao = x
    }
    x = data
    if (x == '') {
        xdata = ''
    } else {
        xdata = x
    }
    x = agenda
    if (x == '') {
        xagenda = ''
    } else {
        xagenda = x
    }
    Swal.fire({
        title: '<strong style="font-size: 25px">Agendar Contato</strong>' + '\n' +
            '<label style="font-size: 15px">Clique no botão abaixo para confirmar</label>',
        width: 800,
        html: '<form method="post" action="/agenda/adicionar"><input type="hidden" name="idagenda" value="' + xagenda + '"><input type="hidden" name="id" value="' + projeto + '"><input type="hidden" name="cliente" value="' + cliente + '"><input type="hidden" name="vendedor" value="' + vendedor + '"><div class="row" style="width: 100%"><div class="col"><label class="col-form-label col-form-label-sm">Descrição</label><textarea name="descricao" placeholder: "Descrição da atividade" class="form-control form-control-sm" rows="8"></textarea></div><div class="col"><label class="col-form-label col-form-label-sm">Histórico</label><textarea readonly class="form-control form-control-sm" rows="8">' + xdescricao + '</textarea></div></div><div class="row mt-3 mb-3" style="width: 100%"><div class="col-md-4 text-end"><label class="col-form-label col-form-label-sm">Data e Hora:</label></div><div class="col-md-4 text-start"><input type="datetime-local" class="form-control form-control-sm" name="data" value="' + xdata + '"></div><div class="col-md-3"><button type="submit" class="btn btn-sm btn-primary"><i class="bi bi-check"></i></button></div></div></form>',
        showCloseButton: true,
        showConfirmButton: false,
    })
}

function evento(divdia) {
    let lista = []
    let dia = document.getElementById(divdia)
    var aux = ''
    div = dia.getElementsByTagName('div')
    for (let x = 0; x < div.length; x++) {
        novaa = document.createElement('a')
        cliente = dia.querySelectorAll('div')
        params = cliente[x].innerText
        params = params.split('@')
        if (params[0].length == 1) {
            novaa.innerText = params[1]
            novaa.style.color = 'white'
            novaa.style.fontSize = '10px'
            if (params[4].length == 21) {
                novaa.href = '/pessoa/edicao/' + params[2]
            } else {
                novaa.href = '/gerenciamento/projeto/' + params[2]
            }
            novaa.style.backgroundColor = params[3]
            novaa.style.paddingTop = '10px'
            novaa.style.paddingLeft = '10px'
            novaa.style.paddingBottom = '10px'
        } else {
            novaa.innerText = params[0] + '\n' + params[1]
            novaa.className = 'card'
            novaa.style.color = 'black'
            novaa.style.fontSize = '12px'
            novaa.href = '/gerenciamento/tarefa/' + params[2]
            aux = params[4]
            aux = aux.split(' ')
            if (aux[0].length - 1 == 5) {
                novaa.style.backgroundColor = params[3]
            } else {
                novaa.style.backgroundColor = 'rgba(46, 255, 102, 0.6)'
            }
            novaa.style.paddingLeft = '10px'
            novaa.style.paddingBottom = '10px'
        }

        lista.push(novaa)
    }
    return lista
}

function posvenda() {
    var tituloclass = document.getElementById('tituloclass')
    var selectclass = document.getElementById('selectclass')
    var titulotipo = document.getElementById('titulotipo')
    var selecttipo = document.getElementById('selecttipo')
    var titulodata = document.getElementById('titulodata')
    var inputdata = document.getElementById('inputdata')
    var card = document.getElementById('card')
    var posvenda = document.getElementById('posvenda')
    if (posvenda.checked) {
        card.style.display = ''
    } else {
        card.style.display = 'none'
    }
}

function excluir() {
    var cliente = document.getElementById('idcliente')
    var usina = document.getElementById('idusina')
    var r = confirm("Tem certeza que deseja excluir a usina?");
    if (r == true) {
        var caminho = '/cliente/excluirusina/' + String(usina.value)
        location.href = caminho
    }
    else {
        var caminho = '/cliente/usinas/' + String(cliente.value)
        location.href = caminho
    }
}

function programa() {
    var usina = document.getElementById('idusina')
    var caminho = '/cliente/programacao/' + String(usina.value)
    location.href = caminho
}

function selectJan() {
    var mes = document.getElementById('selectjan')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectFev() {
    var mes = document.getElementById('selectfev')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectFev() {
    var mes = document.getElementById('selectfev')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectMar() {
    var mes = document.getElementById('selectmar')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectAbr() {
    var mes = document.getElementById('selectabr')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectMai() {
    var mes = document.getElementById('selectmai')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectJun() {
    var mes = document.getElementById('selectjun')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectJul() {
    var mes = document.getElementById('selectjul')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectAgo() {
    var mes = document.getElementById('selectago')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectSet() {
    var mes = document.getElementById('selectset')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectOut() {
    var mes = document.getElementById('selectout')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectNov() {
    var mes = document.getElementById('selectnov')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectDez() {
    var mes = document.getElementById('selectdez')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}
function selectTodos() {
    var mes = document.getElementById('selecttodos')
    var mesatu = document.getElementById('mes')
    mesatu.value = mes.innerText
}

function salvar() {
    var txthtml = ''
    var dados = document.getElementById('dados')
    var negociando = document.getElementsByClassName('item-negociando')
    var baixado = document.getElementsByClassName('item-baixado')
    var ganho = document.getElementsByClassName('item-ganho')

    for (i = 0; i < negociando.length; i++) {
        txthtml = txthtml + '<input type="hidden" name="idneg[]" value="' + negociando[i].innerText + '">'
    }
    for (i = 0; i < baixado.length; i++) {
        txthtml = txthtml + '<input type="hidden" name="idbax[]" value="' + baixado[i].innerText + '">'
    }
    for (i = 0; i < ganho.length; i++) {
        txthtml = txthtml + '<input type="hidden" name="idgan[]" value="' + ganho[i].innerText + '">'
    }
    dados.innerHTML = txthtml
}

function novoEndereco() {
    var check = $('#check')
    var local = $('#local')
    if (check.is(':checked')) {
        local.show()
    } else {
        local.hide()
    }
}

function mostrares() {
    var check = $('#checkres')
    var res = $('#responsavel')
    if (check.is(':checked')) {
        res.show()
    } else {
        res.hide()
    }
}

function imprimir() {
    var uc = document.getElementById('uc')
    var descuc = document.getElementById('descuc')
    var data = document.getElementById('data')
    var descdata = document.getElementById('descdata')

    descuc.innerHTML = uc.value
    uc.style.display = 'none'
    descuc.style.display = ''
    // alert(data.value)
    descdata.innerHTML = data.value
    data.style.display = 'none'
    descdata.style.display = ''
}

function addequipamento() {
    var equipamentos = document.getElementById("equipamentos")
    //alert('equipamentos=>' + equipamentos)
    var desc_equi = document.getElementById("desc_equi")
    //alert('desc_equi=>' + desc_equi)
    var qtd_equi = document.getElementById("qtd_equi")
    //alert('qtd_equi=>' + qtd_equi)
    var row = document.createElement('div')
    var col1 = document.createElement('div')
    var col2 = document.createElement('div')
    var desc = document.createElement('label')
    var qtd = document.createElement('label')
    var qtd_hidden = document.createElement('input')
    var desc_hidden = document.createElement('input')
    row.className = 'row'
    col1.className = 'col'
    col2.className = 'col'
    desc.className = 'col-form-label col-form-label-sm'
    desc.textContent = desc_equi.value
    qtd.className = 'col-form-label col-form-label-sm'
    qtd.textContent = qtd_equi.value
    qtd_hidden.type = 'hidden'
    qtd_hidden.name = 'qtd[]'
    qtd_hidden.value = qtd_equi.value
    desc_hidden.type = 'hidden'
    desc_hidden.name = 'desc[]'
    desc_hidden.value = desc_equi.value
    col1.append(desc)
    col1.append(desc_hidden)
    col2.append(qtd)
    col2.append(qtd_hidden)
    row.append(col1)
    row.append(col2)
    equipamentos.prepend(row)
}

function somaTotal() {
    var material = document.getElementById('vlrKit')
    var servico = document.getElementById('vlrServico')
    var total = document.getElementById('vlrTotal')
    if (String(material.value).length > 0 && String(servico.value).length > 0) {
        total.value = parseFloat(material.value) + parseFloat(servico.value)
    } else {
        if (String(material.value).length > 0) {
            total.value = parseFloat(material.value)
        } else {
            total.value = parseFloat(servico.value)
        }
    }
}

function novoVoltar() {
    var status = $('#btnovo').text();
    if (status == 'Novo') {
        $('#obstext').val('');
        $('#btnovo').text('Voltar');
        $('#insertObs').val(true);
        $('#obstext').prop('readonly', false)
    } else {
        window.location.reload();
    }
}   

function verifyCheck(field,refreh,form) {
    var check = $('#'+field);
    $('#'+refreh).val(check.is(':checked'));
    handleSubmit(form);
}

function handleSubmit(form) {
    $('#'+form).submit();
}

$(document).ready(function () {
    
    var inputsCEP = $('#rua', '#cidade', '#estado', '#bairro');
    var inputsRUA = $('#cep', '#bairro');

    function limpa_formulário_cep() {
        // Limpa valores do formulário de cep.
        // $("#rua").val("");
        // $("#bairro").val("");
        // $("#cidade").val("");
        // $("#estado").val("");
        inputsCEP.val('');
    }
    
    //Quando o campo cep perde o foco.
    $("#cep").blur(function () {

        //Nova variável "cep" somente com dígitos.
        var cep = $(this).val().replace(/\D/g, '');

        //Verifica se campo cep possui valor informado.
        if (cep != "") {

            //Expressão regular para validar o CEP.
            var validacep = /^[0-9]{8}$/;

            //Valida o formato do CEP.
            if (validacep.test(cep)) {

                //Preenche os campos com "..." enquanto consulta webservice.
                // $("#rua").val("...");
                // $("#bairro").val("...");
                // $("#cidade").val("...");
                // $("#estado").val("...");
                inputsCEP.val('...');

                //Consulta o webservice viacep.com.br/
                $.getJSON("https://viacep.com.br/ws/" + cep + "/json/?callback=?", function (dados) {

                    if (!("erro" in dados)) {
                        //Atualiza os campos com os valores da consulta.
                        $("#rua").val(dados.logradouro);
                        $("#bairro").val(dados.bairro);
                        $("#cidade").val(dados.localidade);
                        $("#estado").val(dados.uf);
                    } //end if.
                    else {
                        //CEP pesquisado não foi encontrado.
                        limpa_formulário_cep();
                        alert("CEP não encontrado.");
                    }
                });
            } //end if.
            else {
                //cep é inválido.
                limpa_formulário_cep();
                alert("Formato de CEP inválido.");
            }
        } //end if.
        else {
            //cep sem valor, limpa formulário.
            limpa_formulário_cep();
        }
    });

    function get(url) {
        $.get(url, function (data) {
            if (!("erro" in data)) {
                if (Object.prototype.toString.call(data) === '[object Array]') {
                    var data = data[0];
                }

                $.each(data, function (nome, info) {
                    $('#' + nome).val(nome == 'cep' ? info.replace(/\D/g, '') : info)
                });
            } else {
                limpa_formulário_cep();
            }
        });
    }
    
    $('#rua').on('blur', function (e) {
        if ($('#rua').val() !== '' && $('#rua').val() !== $('#rua').attr('info')
            && $('#cidade').val() !== '' && $('#cidade').val() !== $('#cidade').attr('info')
            && $('#estado').val() !== '' && $('#estado').val() !== $('#estado').attr('info')) {

            inputsRUA.val('...')
            get("https://viacep.com.br/ws/" + $('#estado').val() + '/' + $('#cidade').val() + '/' + $('#rua').val() + '/json/')
        }
    });
    
});

