const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const { google } = require('googleapis')
require('dotenv').config()

require('../model/Cliente')
require('../model/Agenda')
require('../model/Projeto')

const { ehAdmin } = require('../helpers/ehAdmin')
// Provide the required configuration
const CREDENTIALS = JSON.parse(process.env.CREDENTIALS);

// Google calendar API settings
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const calendar = google.calendar({ version: "v3" });

const auth = new google.auth.JWT(
    CREDENTIALS.client_email,
    null,
    CREDENTIALS.private_key,
    SCOPES
)

const Agenda = mongoose.model('agenda')
const Cliente = mongoose.model('cliente')
const Projeto = mongoose.model('projeto')

const naoVazio = require('../resources/naoVazio')

router.post('/adicionar', ehAdmin, (req, res) => {
    const { email_agenda } = req.user
    const { _id } = req.user
    const { user } = req.user
    var id
    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    // Get date-time string for calender
    // const dateTimeForCalander = () => {

    //     let date = new Date();

    //     let year = date.getFullYear();
    //     let month = date.getMonth() + 1;
    //     if (month < 10) {
    //         month = `0${month}`;
    //     }
    //     let day = date.getDate();
    //     if (day < 10) {
    //         day = `0${day}`;
    //     }
    //     let hour = date.getHours();
    //     if (hour < 10) {
    //         hour = `0${hour}`;
    //     }
    //     let minute = date.getMinutes();
    //     if (minute < 10) {
    //         minute = `0${minute}`;
    //     }


    //     let newDateTime = `${year}-${month}-${day}T${hour}:${minute}:00.000${TIMEOFFSET}`;

    //     let event = new Date(Date.parse(newDateTime));

    //     let startDate = event;
    //     // Delay in end time is 1
    //     let endDate = new Date(new Date(startDate).setHours(startDate.getHours() + 1));

    //     return {
    //         'start': startDate,
    //         'end': endDate
    //     }
    // }

    // // Insert new event to Google Calendar
    const insertEvent = async (event) => {

        try {
            let response = await calendar.events.insert({
                auth: auth,
                calendarId: email_agenda,
                resource: event
            });

            if (response['status'] == 200 && response['statusText'] === 'OK') {
                return 1
            } else {
                return 0
            }
        } catch (error) {
            console.log(`Error at insertEvent --> ${error}`)
            return 0
        }
    }

    // console.log('req.body.cliente=>' + req.body.cliente)
    // console.log('req.body.responsavel=>' + req.body.responsavel)
    // console.log('req.body.descricao=>' + req.body.descricao)
    // console.log('data=>' + req.body.data)
    // console.log('agenda=>' + req.body.idagenda)
    // console.log('req.body.id=>' + req.body.id)
    Projeto.findOne({ _id: req.body.id }).then((projeto) => {
        Cliente.findOne({ _id: req.body.cliente }).then((cliente) => {
            // console.log("achou cliente")
            let dataini = new Date(Date.parse(req.body.data))
            // console.log('dataini=>'+dataini)
            let datafim = new Date(new Date(dataini).setHours(dataini.getHours() + 1))
            // console.log('datafim=>'+datafim)
            var idagenda
            if (naoVazio(req.body.idagenda)) {
                idagenda = req.body.idagenda
            } else {
                idagenda = '111111111111111111111111'
            }
            // console.log('idagenda=>'+idagenda)
            Agenda.findOne({ _id: idagenda }).then((achou_agenda) => {
                // console.log('achou_agenda=>'+achou_agenda)
                if (naoVazio(achou_agenda)) {
                    achou_agenda.data = req.body.data
                    achou_agenda.descricao = achou_agenda.descricao + '\n' + "[" + req.body.data + "]" + '\n' + req.body.descricao
                    achou_agenda.save().then(() => {
                        let event = {
                            'summary': cliente.nome,
                            'description': req.body.descricao,
                            'start': {
                                'dateTime': dataini,
                                'timeZone': 'America/Sao_Paulo'
                            },
                            'end': {
                                'dateTime': datafim,
                                'timeZone': 'America/Sao_Paulo'
                            }
                        }

                        insertEvent(event)
                            .then((response) => {
                                console.log(response)
                                req.flash("success_msg", "Agenda marcada.")
                                if (req.body.voltar == 'dashboard'){
                                    res.redirect('/dashboard')
                                }else{
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                }
                            })
                            .catch((err) => {
                                console.log(err)
                                req.flash('error_msg', 'Houve um erro ao salvar a agenda.')
                                res.redirect('/gerenciamento/orcamento/' + req.body.id)
                            })
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve um erro ao salvar a agenda.')
                        res.redirect('/gerenciamento/orcamento/' + req.body.id)
                    })
                } else {

                    const corpo = {
                        user: id,
                        cliente: cliente._id,
                        pessoa: req.body.vendedor,
                        data: req.body.data,
                        descricao: "[" + req.body.data + "] - " + req.body.descricao
                    }
                    console.log('corpo=>' + corpo)
                    new Agenda(corpo).save().then(() => {
                        projeto.futuro = true
                        projeto.status = 'Futuro'
                        var data = String(req.body.data)
                        var ano = data.substring(0, 4)
                        var mes = data.substring(5, 7)
                        var dia = data.substring(8, 10)
                        data = ano + '-' + mes + '-' + dia
                        projeto.save().then(() => {
                            // let dateTime = dateTimeForCalander()
                            // Event for Google Calendar

                            let event = {
                                'summary': cliente.nome,
                                'description': 'Notificação Vimmus: - ' + req.body.descricao,
                                'start': {
                                    'dateTime': dataini,
                                    'timeZone': 'America/Sao_Paulo'
                                },
                                'end': {
                                    'dateTime': datafim,
                                    'timeZone': 'America/Sao_Paulo'
                                }
                            }
                            console.log('salvar agenda google')
                            insertEvent(event)
                                .then((response) => {
                                    console.log(response)
                                    req.flash("success_msg", "Agenda marcada.")
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                })
                                .catch((err) => {
                                    console.log(err)
                                    req.flash('error_msg', 'Houve um erro ao salvar a agenda.')
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                })
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve um erro ao salvar a agenda.')
                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve um erro ao salvar o projeto.')
                        res.redirect('/gerenciamento/orcamento/' + req.body.id)
                    })
                }
            })

        }).catch((err) => {
            req.flash('error_msg', 'Houve um erro ao encontrar o cliente.')
            res.redirect('/gerenciamento/orcamento/' + req.body.id)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Houve um erro ao encontrar o projeto.')
        res.redirect('/gerenciamento/orcamento/' + req.body.id)
    })
})

// Get all the events between two dates
// const getEvents = async (dateTimeStart, dateTimeEnd) => {

//     try {
//         let response = await calendar.events.list({
//             auth: auth,
//             calendarId: calendarId,
//             timeMin: dateTimeStart,
//             timeMax: dateTimeEnd,
//             timeZone: 'Asia/Kolkata'
//         });

//         let items = response['data']['items'];
//         return items;
//     } catch (error) {
//         console.log(`Error at getEvents --> ${error}`);
//         return 0;
//     }
// };

// // let start = '2020-10-03T00:00:00.000Z';
// // let end = '2020-10-04T00:00:00.000Z';

// // getEvents(start, end)
// //     .then((res) => {
// //         console.log(res);
// //     })
// //     .catch((err) => {
// //         console.log(err);
// //     });

// // Delete an event from eventID
// const deleteEvent = async (eventId) => {

//     try {
//         let response = await calendar.events.delete({
//             auth: auth,
//             calendarId: calendarId,
//             eventId: eventId
//         });

//         if (response.data === '') {
//             return 1;
//         } else {
//             return 0;
//         }
//     } catch (error) {
//         console.log(`Error at deleteEvent --> ${error}`);
//         return 0;
//     }
// };

// let eventId = 'hkkdmeseuhhpagc862rfg6nvq4';

// deleteEvent(eventId)
//     .then((res) => {
//         console.log(res);
//     })
//     .catch((err) => {
//         console.log(err);
//     })

module.exports = router 
