import axios from 'axios'
import * as cheerio from 'cheerio'
import emailValidator from 'deep-email-validator'
import { config } from 'dotenv'
import puppeteer from 'puppeteer'

config()

async function getEmails(url){
    const emails = []
    
    try {
        const initialemails = await getEmailsSinglePage(url)
        emails.push(...initialemails)
        const links = await getInternalLinks(url)

        for (const link of links){
            const returnedEmails = await getEmailsSinglePage(link)
            emails.push(...returnedEmails)
        }

        return emails
    } catch (error) {
        return []
    }
}
async function getInternalLinks(url) {
    try {
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html); 
        const baseUrl = getRootDomain(url)
        const internalLinks = [];

        $('a').each((i, elem) => {
            try {
                const href = $(elem).attr('href')
                if(href){
                    if (href.includes(baseUrl)){
                        internalLinks.push(href);
                    }
                }
            } catch(error) {
                return
            }
        })

        return internalLinks
    } catch (error){
        return []
    }
}
function getRootDomain(url){
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    return domain;
}
async function getEmailsSinglePage(url) {
    const emails = [];
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g;

    try {
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);

        // Extract emails from text content in the body
        const textContent = $('body').text();
        const matchedEmails = textContent.match(emailRegex);
        if (matchedEmails) {
            emails.push(...matchedEmails);
        }

        // Extract emails from href attributes of a tags
        $('a[href^="mailto:"]').each((_, element) => {
            const href = $(element).attr('href');
            const email = href.replace(/^mailto:/, ''); // Remove the mailto: part
            emails.push(email);
        });

        return emails;
    } catch (error) {
        return [];
    }
}
async function getSocialLinks(url){
    //NOTE: only scrapes the first page
    const twitterRegex = /https?:\/\/(www\.)?twitter\.com\/[A-Za-z0-9_]+/g
    const facebookRegex = /https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9.]+/g
    const linkedinRegex = /https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9-]+/g
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+/g
    const youtubeRegex = /https?:\/\/(www\.)?(youtube\.com\/(channel|c|user|watch\?v=)|youtu\.be\/)[A-Za-z0-9_\-]+/g

    try {
        const { data: html } = await axios.get(url)
        const $ = cheerio.load(html);        
        const textContent = $('body').text()
        const twitterLinks = textContent.match(twitterRegex);
        const facebookLinks = textContent.match(facebookRegex);
        const linkedinLinks = textContent.match(linkedinRegex);
        const instagramLinks = textContent.match(instagramRegex);
        const youtubeLinks = textContent.match(youtubeRegex)

        return {
            twitter: twitterLinks,
            facebook: facebookLinks,
            linkedin: linkedinLinks,
            instagram: instagramLinks,
            youtube: youtubeLinks
        }
    } catch (error) {
        return {}
    }

}
async function verifyEmail(email) {
    const validity = await emailValidator.validate(email) // make sure to add IP roatation
    return {
        isValid: validity.valid,
        reason: validity.reason || null
    }
}
async function generateEmailPermutations(firstName, lastName, domain) {

    const first = firstName.toLowerCase();
    const last = lastName.toLowerCase();
    const f = first.charAt(0);
    const l = last.charAt(0);
    const verifiedEmails = []

    const parsedUrl = new URL(domain);
    const origin = parsedUrl.origin;

        //add more patterns
    const emailPatterns = [
        `${first}@${origin}`,
        `${last}@${origin}`,
        `${first}.${last}@${origin}`,
        `${first}${last}@${origin}`,
        `${f}.${last}@${origin}`,
        `${f}_${last}@${origin}`,
        `${last}.${first}@${origin}`,
        `${first}-${last}@${origin}`,
        `${last}-${first}@${origin}`,
        `${first}_${last}@${origin}`,
        `${f}${last}@${origin}`,
        `${first}${l}@${origin}`
    ];

    for (const email of emailPatterns){
        const isValid = await verifyEmail(email)
        if(isValid.isValid){
            verifiedEmails.push(email)

        }else{
            continue
        }
    }


    return verifiedEmails;

}
// async function getPhoneNumber(url) {
//     const phoneRegex = /\+?(\d{1,3})?[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
//     try {
//         const { data: html } = await axios.get(url)
//         const $ = cheerio.load(html);        
//         const textContent = $('body').text()
//         const phoneNumbers = textContent.match(phoneRegex);
//         return phoneNumbers
//     } catch (error) {
//         return []
//     }
// } under development

async function getPagePeformance(url){
    try{
        const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&key=${process.env.PAGE_SPEED_API}`)
        if(!res.ok){
            throw new Error('Fetch Error')
        }
        const performanceData = await res.json()
        const diagnostics = Object.values(performanceData.lighthouseResult?.audits)
        .filter(audit => audit.details && audit.details.type === 'diagnostic')
        .map(diagnostic => ({
            title: diagnostic.title,
            description: diagnostic.description
        }));


        return {
            tti: performanceData.lighthouseResult.audits.interactive.displayValue, // The time it takes for the page to become fully interactive, where the page has loaded and is ready to respond to user inputs.
            speed: performanceData.lighthouseResult.audits['speed-index'].displayValue, // How quickly the content of a page is visibly populated.
            diagnostics: diagnostics
        }
    }catch(err){
        return {error: err.message}
    }
}

async function isUsingMetaAds(url){
    let browser;
    let page;
    let hasFacebookPixel = false;
    try {
        browser = await puppeteer.launch()
        page = await browser.newPage()
        page.setDefaultNavigationTimeout(120000)
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('connect.facebook.net')) {
                hasFacebookPixel = true;
            }
        });
        await page.goto(url);
        await page.waitForTimeout(10000); // Wait for a few seconds to capture network requests
        if (hasFacebookPixel) {
            console.log('Facebook Pixel is present on the page.');
            return true
        } else {
            console.log('Facebook Pixel is not present on the page.');
            return false
        }
    } catch (error) {
        return {error: error.message}   
    }finally{
        await page?.close()
        await browser?.close()
    }
}
async function isUsingTwitterAds(url){
    let browser;
    let page;
    let hasTwitterPixel = false;
    try {
        browser = await puppeteer.launch()
        page = await browser.newPage()
        page.setDefaultNavigationTimeout(120000)
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('static.ads-twitter.com')) {
                hasTwitterPixel = true;
            }
        });
        await page.goto(url);
        await page.waitForTimeout(10000); // Wait for a few seconds to capture network requests
        if (hasTwitterPixel) {
            console.log('Twitter Pixel is present on the page.');
            return true
        } else {
            console.log('Twitter Pixel is not present on the page.');
            return false
        }
    } catch (error) {
        return {error: error.message}   
    }finally{
        await page?.close()
        await browser?.close()
    }
}
async function isUsingPinterestAds(url) {
    let browser;
    let page;
    let hasPinterestAds = false;
    try {
        browser = await puppeteer.launch()
        page = await browser.newPage()
        page.setDefaultNavigationTimeout(120000)
        page.on('request', (request) => {
            const url = request.url();
            // Pinterest tracking/ads domains can include:
            // - "tr.pinterest.com" (Pinterest Tag/Pixel)
            // - "ct.pinterest.com" (Pinterest Ads click tracking)
            // - "ads.pinterest.com" (General Pinterest Ads domain)
            if (url.includes('tr.pinterest.com') || url.includes('ct.pinterest.com') || url.includes('ads.pinterest.com')) {
                hasPinterestAds = true;
            }
        });
        await page.goto(url);
        await page.waitForTimeout(10000); // Wait for a few seconds to capture network requests
        if (hasPinterestAds) {
            console.log('Pinterest Pixel is present on the page.');
            return true
        } else {
            console.log('Pinterest Pixel is not present on the page.');
            return false
        }
    } catch (error) {
        return {error: error.message}   
    }finally{
        await page?.close()
        await browser?.close()
    }
}
async function isUsingGoogleAds(url){
    let browser;
    let page;
    let hasGoogleAds = false;
    try {
        browser = await puppeteer.launch()
        page = await browser.newPage()
        page.setDefaultNavigationTimeout(120000)
        page.on('request', (request) => {
            const url = request.url();
            // Google Ads related domains
            if (url.includes('googleads.g.doubleclick.net') ||
                url.includes('pagead2.googlesyndication.com') ||
                url.includes('adservice.google.com') ||
                url.includes('tpc.googlesyndication.com') ||
                url.includes('www.googleadservices.com')) {
                hasGoogleAds = true;
            }
        });
        await page.goto(url);
        await page.waitForTimeout(10000); // Wait for a few seconds to capture network requests
        if (hasGoogleAds) {
            console.log('Google Pixel is present on the page.');
            return true
        } else {
            console.log('Google Pixel is not present on the page.');
            return false
        }
    } catch (error) {
        return {error: error.message}   
    }finally{
        await page?.close()
        await browser?.close()
    }
}
async function getSiteCategory(){
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `Bearer ${process.env.OPENAI_KEY}`
            },
            body: JSON.stringify({
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": "Say this is a hello world test!"}],
                "temperature": 0.7
            })
        })
        if(!res.ok){
            const errorJSON = await res.json()
            console.log(errorJSON)
            // throw new Error(errorJSON)
        }

        const resJSON = await res.json()
        return resJSON
    } catch (error) {
        // return error.message
    }
}

getSiteCategory()
.then((result)=>{
    console.log(result)
})
.catch((err)=>{
    console.log(err)
})