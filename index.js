import puppeteer from "puppeteer-core"
import express from 'express'
import Prometheus from "./utils.js"
import {config} from 'dotenv'
import cors from 'cors'
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

config()
const app = express()
let server;
let wss;
const clients = new Map()
server = app.listen(8080, ()=>{
    console.log('Server running')
})
wss = new WebSocketServer({ server });
app.use((req, res, next) => {
    const apiKey = req.header('x-api-key');
    if (apiKey && apiKey === process.env.SERVER_API_KEY) {
      next(); 
    } else {
      res.status(403).send('Forbidden'); // Invalid API key
    }
})
app.use(cors({
    origin: '*'
}))
app.use(express.json());
wss.on('connection', ws => {
    const id = uuidv4(); 
    clients.set(id, ws);
    ws.id = id; 
    broadcast(id, id, 'id')
    console.log('Client:', id, ' ,connected to WebSocket server');
    ws.on('close', () => {
        clients.delete(id)
        console.log('Client:', id, ' ,disconnected from WebSocket server');
    });
});
function broadcast(id, data, type) {
    const client = clients.get(id);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, data }))
    } else {
        console.error(`Client with ID ${id} not found or not open`);
    }
}
function closeClientConnection(id) {
    const client = clients.get(id);
    if (client) {
        client.close(); // Close the WebSocket connection
        clients.delete(id); // Remove client from the map
        console.log(`Client with ID ${id} has been disconnected`);
    } else {
        console.error(`Client with ID ${id} not found`);
    }
}

app.post('/api/google-maps', async (req,res)=>{
    const {service, location , pagination, clientId } = req.body
    let page;    
    let browser;
    for(let browserRetries = 0; browserRetries < 4; browserRetries++){
        try {
            browser = await puppeteer.connect({
                browserWSEndpoint: process.env.BROWSER_URL
            })
            page = await browser.newPage();
            await page.setRequestInterception(true);  
            page.on('request', (request) => {  
                if (request.resourceType() === 'image') {  
                    request.abort(); 
                } else {  
                    request.continue();  
                }
            })
            if(browser && page){
                break
            }else{
                throw new Error('Browser Launch Fail, retrying... :', browserRetries)
            }
        } catch (error) {
            await page?.close()
            await browser?.close()
            if(browserRetries === 3){
                return res.sendStatus(500)
            }
        }

    }
    try { 
        await page.goto(`https://www.google.com/localservices/prolist?g2lbs=AIQllVxEpXuuCPFrOHRAavT6nJMeIXUuM9D7r7-IlczaiEuKdgYVA09lqC7MIhZ3mUJ_MfwMM30K5vDmEB9UFLvwoZMUuqe_RIT2RmrDlIhrFndV8WuAgW-ioANkhbKSz__jtHfxKrJZLfFak9ca1Vbqi4HEnaKw7Q%3D%3D&hl=en-US&gl=&cs=1&ssta=1&q=${service}+in+${location}&oq=${service}+in+${location}&scp=Cg5nY2lkOmFyY2hpdGVjdBJMEhIJSTKCCzZwQIYRPN4IGI8c6xYaEgkLNjLkhLXqVBFCt95Dkrk7HCIKVGV4YXMsIFVTQSoUDV1uZg8VcypvwB3BkMEVJTvOQ8gwABoKYXJjaGl0ZWN0cyITYXJjaGl0ZWN0cyBpbiB0ZXhhcyoJQXJjaGl0ZWN0&slp=MgA6HENoTUkxWXZoamNfVmhBTVZZSUJRQmgxMkpBRTRSAggCYACSAZsCCgsvZy8xdGg2ZjZ4ZwoNL2cvMTFoY3c1ZDltZAoLL2cvMXd5YzRybWQKDC9nLzEycWg5dzhmZAoNL2cvMTFnNm5sMGxmNQoLL2cvMXRkY2dzdjQKCy9nLzF0aGwxODBzCgsvZy8xdGc3c2RmNwoLL2cvMXRkNGR6cTEKCy9nLzF0ZnNuZDRfCg0vZy8xMWI3bHBtOGIxCgsvZy8xdHp6dng1bAoLL2cvMXRrNHJsMTEKCy9nLzF0a3ZiNGpzCg0vZy8xMWJ4OGNteHM4Cg0vZy8xMWNuMF93MTkxCgsvZy8xdG15NWdzaAoLL2cvMXYzaF9jM3EKCy9nLzF2eWsyeHpnCgsvZy8xdGZtY24xcRIEEgIIARIECgIIAZoBBgoCFxkQAA%3D%3D&src=2&serdesk=1&sa=X&ved=2ahUKEwiyo9uNz9WEAxUMQkEAHZWwBcEQjGp6BAgfEAE&lci=${(parseInt(pagination))*20}`)

        try {
            await page.waitForSelector('div.rgnuSb.xYjf2e');
            await page.waitForSelector('.AIYI7d');
            console.log('Card loaded')
        } catch (error) {
            console.log('Card Not loaded')
        }
        const cards = await page.$$('div[jsname="gam5T"]');
        console.log('Card extracted')
        const initInfo = []
        for (const card of cards) {
            let name 
            try {
                name = await card.$eval('div.rgnuSb.xYjf2e', node => node.textContent)
            } catch (error) {
                continue
            }
            let phone 
            try {
                phone = await card.$eval('div.NwqBmc > div.I9iumb:nth-child(3) > span.hGz87c:last-child', node => node.textContent)
            } catch (error) {
                continue
            }
            let url 
            try {
                url = await card.$eval('a[aria-label="Website"]', node => node.href)
            } catch (error) {
                continue
            }
            const engine = new Prometheus(url)
            const emails = await engine.getEmails()
            const socials = await engine.getSocialLinks()
            const performance = await engine.getPagePeformance()
            const ads = await engine.adsUsed()
            const techStack = await engine.techStack()
            broadcast(clientId, JSON.stringify({name, url, phone, emails, performance, ads, techStack, socials}), 'lead')
            console.log({name, url, phone, emails, performance, ads, techStack, socials})
        }
        await page.close()
        await browser.close()
        return res.sendStatus(200)
    } catch (error) {
        console.error("Error in GMP Scraper:", error.message)
        await page?.close()
        await browser?.close()
        return res.sendStatus(500)
    }
})
app.post('/api/yelp', async (req,res)=>{
    const {service, location, pagination} = req.body
    const cardSelector = '#main-content > ul'
    console.log('Received yelp request')
    const yelpUrl = `https://www.yelp.com/search?find_desc=${service}&find_loc=${location}${pagination > 0 ? `&start=${pagination*10}` : ''}`
    let browser;
    let page;

    
    try {
        for(let browserRetries = 0; browserRetries < 4; browserRetries++){
            try {
                browser = await puppeteer.connect({
                    browserWSEndpoint: process.env.BROWSER_URL
                })
                page = await browser.newPage();
                await page.setRequestInterception(true);  
                page.on('request', (request) => {  
                    if (request.resourceType() === 'image') {  
                        request.abort();  
                    } else {  
                        request.continue();  
                    }
                })
                if(browser && page){
                    break
                }else{
                    throw new Error('Browser Launch Fail, retrying... :', browserRetries)
                }
            } catch (error) {
                console.log('Browser luanch error: ', error.message)
                if(browserRetries === 3){
                    return res.sendStatus(500)
                }
            }
        }
        await page.goto(yelpUrl) 
        console.log('Page navigated')
        try {
            await page.waitForSelector(cardSelector);
            console.log('Card loaded')
        } catch (error) {
            console.log('Card Not loaded: ', error.message)
        }

        const cards = await page.$(cardSelector);
        console.log('Card extracted')
        const initInfo = []
        for (const card of cards) {
            let name
            try {
                name = await card.$eval('y-css-12ly5yx', node => node.textContent || null)
            } catch (error) {
                continue
            }
            const businessYelpPage = await card.$eval('y-css-12ly5yx', node => node?.href || null)
            console.log('Name is:', name)
            console.log('Url: ', businessYelpPage)
            if(businessYelpPage){
                try {
                    await page.goto(businessYelpPage)
                    await page.waitForSelector('div.y-css-1lfp6nf')
                    console.log('All data appeared')
                    const cardData = await page.$('div.y-css-1lfp6nf')
                    const phone = cardData.$eval('p.y-css-1o34y7f', node => node.textContent)
                    const href = cardData.$eval('a.y-css-1rq499d', node => node.href)
                    const queryString = href.split('?')[1];
                    const decodedQueryString = queryString.replace(/&amp;/g, '&');
                    const params = new URLSearchParams(decodedQueryString);
                    const url = params.get('url');

                    initInfo.push({name,phone,url})
                } catch (error) {
                    console.log('Error scraping page')
                }
                
            }
        }
        await page.close()
        await browser.close()

        return res.json({data: initInfo}).status(200)

    } catch (error) {
        await page?.close()
        await browser?.close()
        console.log(error.message)
        return res.sendStatus(500)
    }

})
app.post('/api/yellow-pages', async (req, res)=>{
    const {service, location, pagination} = req.body
    console.log('Received request')
    let browser;
    let page;
    const yellowPagesUrl = `https://www.yellowpages.com/search?search_terms=${service}&geo_location_terms=${location}${pagination > 0 ? `&page=${pagination}` : ''}`
    const cardSelector = 'div.srp-listing.clickable-area'

    for(let browserRetries = 0; browserRetries < 4; browserRetries++){
        try {
            browser = await puppeteer.connect({
                browserWSEndpoint: process.env.BROWSER_URL
            })
            page = await browser.newPage();
            await page.setRequestInterception(true);  
            page.on('request', (request) => {  
                if (request.resourceType() === 'image') {  
                    request.abort();  
                } else {  
                    request.continue();  
                }
            })
            if(browser && page){
                break
            }else{
                throw new Error('Browser Launch Fail, retrying... :', browserRetries)
            }
        } catch (error) {
            console.info('Browser luanch error: ', error.message)
            if(browserRetries === 3){
                return res.sendStatus(500)
            }
        }
    }
    try {

        await page.goto(yellowPagesUrl) 
        console.log('Page navigated')
        try {
            await page.waitForSelector(cardSelector);
        } catch (error) {
            console.log('Card Not loaded: ', error.message)
        }

        const cards = await page.$$(cardSelector);
        console.log('Card extracted')
        const initInfo = []
        for (const card of cards) {
            let name 
            try {
                name = await card.$eval('a.business-name span', node => node?.textContent || null)
            } catch (error) {
                continue
            }
            let url;
            try {
                url = await card.$eval('a.track-visit-website', node => node?.getAttribute('href') || null);
            } catch (error) {
                continue
            }
            let phone 
            try {
                phone = await card.$eval('div.phones.phone.primary', node => node?.textContent)
            } catch (error) {
                continue
            } 
            const engine = new Prometheus(url)
            const emails = await engine.getEmails()
            const socials = await engine.getSocialLinks()
            const peformance = await engine.getPagePeformance()
            const ads = await engine.adsUsed(page)
            const techStack = await engine.techStack()
            const traffic = await engine.webTraffic()
            broadcast(clientId, JSON.stringify({name, url, phone, emails, peformance, ads, techStack, traffic, socials}), 'lead')
            console.log({name, url, phone,emails, peformance, ads, techStack, traffic})
        }
        await page.close()
        await browser.close()

        return res.json({data: initInfo}).status(200)
    } catch (error) {
        await page?.close()
        await browser?.close()
        console.error(error.message)
        return res.sendStatus(500)
    }
})
app.get('/api/cancel-process', async (req, res) => {
    const {clientId} = req.query
    console.log('Received cancel-process request. Cleaning up...');
    closeClientConnection(clientId)
    res.send('Process cancellation initiated');
});
