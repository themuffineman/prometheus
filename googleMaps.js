import puppeteer from "puppeteer"
import express from 'express'
import {config} from 'dotenv'
import { serverVerification } from "./middleware"

config()
const app = express()
app.listen(process.env.G_MAPS_PORT, ()=>{
    console.log('GMAPS server up and running')
})
app.use(serverVerification)
app.use(express.json());
app.post(async (req,res)=>{
    const {service, location , pagination } = req.body
    let browser;
    let page;
    try {
        browser = await puppeteer.launch()
        page = browser.newPage()
        await page.goto(`https://www.google.com/localservices/prolist?g2lbs=AIQllVxEpXuuCPFrOHRAavT6nJMeIXUuM9D7r7-IlczaiEuKdgYVA09lqC7MIhZ3mUJ_MfwMM30K5vDmEB9UFLvwoZMUuqe_RIT2RmrDlIhrFndV8WuAgW-ioANkhbKSz__jtHfxKrJZLfFak9ca1Vbqi4HEnaKw7Q%3D%3D&hl=en-US&gl=&cs=1&ssta=1&q=${service}+in+${location}&oq=${service}+in+${location}&scp=Cg5nY2lkOmFyY2hpdGVjdBJMEhIJSTKCCzZwQIYRPN4IGI8c6xYaEgkLNjLkhLXqVBFCt95Dkrk7HCIKVGV4YXMsIFVTQSoUDV1uZg8VcypvwB3BkMEVJTvOQ8gwABoKYXJjaGl0ZWN0cyITYXJjaGl0ZWN0cyBpbiB0ZXhhcyoJQXJjaGl0ZWN0&slp=MgA6HENoTUkxWXZoamNfVmhBTVZZSUJRQmgxMkpBRTRSAggCYACSAZsCCgsvZy8xdGg2ZjZ4ZwoNL2cvMTFoY3c1ZDltZAoLL2cvMXd5YzRybWQKDC9nLzEycWg5dzhmZAoNL2cvMTFnNm5sMGxmNQoLL2cvMXRkY2dzdjQKCy9nLzF0aGwxODBzCgsvZy8xdGc3c2RmNwoLL2cvMXRkNGR6cTEKCy9nLzF0ZnNuZDRfCg0vZy8xMWI3bHBtOGIxCgsvZy8xdHp6dng1bAoLL2cvMXRrNHJsMTEKCy9nLzF0a3ZiNGpzCg0vZy8xMWJ4OGNteHM4Cg0vZy8xMWNuMF93MTkxCgsvZy8xdG15NWdzaAoLL2cvMXYzaF9jM3EKCy9nLzF2eWsyeHpnCgsvZy8xdGZtY24xcRIEEgIIARIECgIIAZoBBgoCFxkQAA%3D%3D&src=2&serdesk=1&sa=X&ved=2ahUKEwiyo9uNz9WEAxUMQkEAHZWwBcEQjGp6BAgfEAE&lci=${(parseInt(pagination))*20}`)

        // Wait for cards to load
        await page.waitForSelector('div.rgnuSb.xYjf2e');
        await page.waitForSelector('.AIYI7d');

        const cards = await page.$$('div[jsname="gam5T"]');
        const initInfo = []
        for (const card of cards) {
            const businessName = await card.$eval('div.rgnuSb.xYjf2e', node => node.textContent);
            const websiteATag = await card.$('a[aria-label="Website"]');
            const url = websiteATag ? await (await websiteATag.getProperty('href')).jsonValue() : null;
            initInfo.push({name: businessName, url: url})
        }
        await page.close()
        const finalInfo = []
        for (const info of initInfo){
            const returnedData = await extractWebsiteData(info.url)
            finalInfo.push(returnedData)
        }
        return res.json({data: finalInfo}).status(200)

    } catch (error) {
        
    }
})