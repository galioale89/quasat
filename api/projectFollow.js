const mongoose = require('mongoose');

require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

require('../model/Projeto');
require('../model/Acesso');
require('../model/Cliente');
require('../model/Pessoa');

const naoVazio = require('../resources/naoVazio');
const dataHoje = require('../resources/dataHoje');
const dataMensagem = require('../resources/dataMensagem')

const Projeto = mongoose.model('projeto');
const Acesso = mongoose.model('acesso');
const Cliente = mongoose.model('cliente');
const Pessoa = mongoose.model('pessoa');

const projectFollow = class {

    constructor(
        date_project,
        date_soli,
        date_aproved,
        date_change,
        observation,
        idPro,
        idUser,
        person,
        checkPaied,
        checkAuth) {
        this.date_project = date_project,
            this.date_soli = date_soli,
            this.date_aproved = date_aproved,
            this.date_change = date_change,
            this.observation = observation,
            this.idPro = idPro,
            this.idUser = idUser,
            this.person = person,
            this.checkPaied = checkPaied,
            this.checkAuth = checkAuth
    }

    setStatusProject(field, value) {
        if (naoVazio(value))
            commitOne(this.idPro, field, value);
    };

    async saveDate(field, check, message) {
        var project = await getProject(this.idPro);
        var isSendMessage = false;
        var dbDate;
        var formDate;

        if (field == 'dataSoli' && (verifyCheckDB(project.dataSoli) || naoVazio(this.date_soli))) {
            var value = this.date_soli;
            dbDate = project.dataSoli;
            formDate = this.date_soli;
        }

        if (field == 'dataApro' && (verifyCheckDB(project.dataApro) || naoVazio(this.date_aproved))) {
            var value = this.date_aproved;
            dbDate = project.dataApro;
            formDate = this.date_aproved;
        }

        if (field == 'dataTroca' && (verifyCheckDB(project.dataTroca) || naoVazio(this.date_change))) {
            var value = this.date_change;
            dbDate = project.dataTroca;
            formDate = this.date_change;
        }

        if (field == 'dataPost' && (verifyCheckDB(project.dataPost) || naoVazio(this.date_project))) {
            var value = this.date_project;
            dbDate = project.dataPost;
            formDate = this.date_project;
        }

        if (check != undefined && !naoVazio(value)) {
            var value = dataHoje();
            formDate = value;
        }

        if (await commitOne(this.idPro, field, value)) {
            var client = await getClientName(project.cliente);
            var accessSeller = await getValidAccessSeller(project.vendedor);
            var seller = await getPeople(project.vendedor);

            if (dbDate != formDate)
                isSendMessage = true;

            try {
                var sellNumber = seller.celular;
                if (naoVazio(accessSeller) && naoVazio(sellNumber) && isSendMessage)
                    sendMessage(seller.nome, project.seq, client.nome, seller.celular, this.idPro, message);
            } catch (error) {
                console.log(error);
            }
        }
    };

    async saveObservation(field, insertobs) {

        let personName;

        if (this.person != undefined) {
            let people = await getPeople(this.person);
            personName = people.nome;
        } else {
            personName = '';
        }

        if (insertobs == 'true') {

            let project = await getProject(this.idPro);
            let time = String(new Date(Date.now())).substring(16, 21);

            var value = `[${dataMensagem(dataHoje())} - ${time}] por ${personName}` + '\n' + this.observation + '\n' + project.obsprojetista;

            commitOne(this.idPro, field, value);
        }
    }
}

async function commitOne(idPro, field, value) {
    var params = {};
    params[field] = value;
    try {
        await Projeto.findOneAndUpdate({ _id: idPro }, { $set: params })
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }

}

function verifyCheckDB(dataBase) {
    if (naoVazio(dataBase)) {
        return true;
    }
    return false;
};

async function sendMessage(sellerName, seqPro, clientName, clientPhone, idPro, message) {
    var mensagem = 'Olá ' + sellerName + ',' + '\n';

    if (message == 'postado')
        mensagem += 'O projeto ' + seqPro + ' do cliente ' + clientName + ' foi ' + message + '.' + '\n';
    else
        mensagem += 'A vistoria da proposta ' + seqPro + ' do cliente ' + clientName + ' foi ' + message + '.' + '\n';

    mensagem += 'Acompanhe a proposta acessando: https://integracao.vimmus.com.br/gerenciamento/orcamento/' + idPro + '.'

    client.messages
        .create({
            body: mensagem,
            from: 'whatsapp:+554991832978',
            to: 'whatsapp:+55' + clientPhone
        })
        .then((message) => {
            console.log(message)
        }).done()
};

async function getProject(idPro) {
    return await Projeto.findById(idPro);;
};

async function getClientName(idCliente) {
    return await Cliente.findById(idCliente);
};

async function getValidAccessSeller(idVendedor) {
    return await Acesso.findOne({ pessoa: idVendedor, notvis: 'checked' });
};

async function getPeople(idPerson) {
    return await Pessoa.findById(idPerson);
};

module.exports = projectFollow;