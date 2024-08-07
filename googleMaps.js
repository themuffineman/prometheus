import puppeteer from "puppeteer"
import express from 'express'
import {config} from 'dotenv'

config()

const server = express()

server.listen(process.env.G_MAPS_PORT, ()=>{
    console.log('GMAPS server up and running')
})