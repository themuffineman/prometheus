import axios from 'axios'
import * as cheerio from 'cheerio'
import emailValidator from 'deep-email-validator'
import { config } from 'dotenv'
import puppeteer from 'puppeteer'
import OpenAI from "openai";
import { z } from "zod";
// import { zodResponseFormat } from "openai/helpers/zod";
config()


export class Prometheus{
    constructor(url) {
        this.url = url;
        this.openai = new OpenAI();

    }
    async getEmails(){
        const emails = []
        
        try {
            const initialemails = await getEmailsSinglePage(this.url)
            emails.push(...initialemails)
            const links = await getInternalLinks(this.url)
    
            for (const link of links){
                const returnedEmails = await getEmailsSinglePage(link)
                for (const email of returnedEmails){
                    const isValid = await verifyEmail(email)
                    if(isValid.isValid){
                        emails.push(email)
                    }else{
                        continue
                    }
                }
            }
    
            return emails
        } catch (error) {
            return []
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
            function getRootDomain(url){
                const parsedUrl = new URL(url);
                const domain = parsedUrl.hostname;
                return domain;
            }
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
        async function verifyEmail(email) {
            const validity = await emailValidator.validate(email) // make sure to add IP roatation
            return {
                isValid: validity.valid,
                reason: validity.reason || null
            }
        }
    }
    async getSocialLinks(){
        //NOTE: only scrapes the first page
        const twitterRegex = /https?:\/\/(www\.)?twitter\.com\/[A-Za-z0-9_]+/g
        const facebookRegex = /https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9.]+/g
        const linkedinRegex = /https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9-]+/g
        const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+/g
        const youtubeRegex = /https?:\/\/(www\.)?(youtube\.com\/(channel|c|user|watch\?v=)|youtu\.be\/)[A-Za-z0-9_\-]+/g
    
        try {
            const { data: html } = await axios.get(this.url)
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
    async getPagePeformance(){
        try{
            const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${this.url}&key=${process.env.PAGE_SPEED_API}`)
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
    async adsUsed(){
        try {
            const browser = await puppeteer.launch()
            const page = await browser.newPage()
            page.setDefaultNavigationTimeout(120000)
            await page.goto(this.url)

            const google = await isUsingGoogleAds(page)
            const twitter = await isUsingTwitterAds(page)
            const pinterest = await isUsingPinterestAds(page)
            const meta = await isUsingMetaAds(page)

            return {
                google,twitter,pinterest,meta
            }
        } catch (error) {
            return {}
        }
        async function isUsingMetaAds(page){
            let hasFacebookPixel = false;
            try {
                page.on('request', (request) => {
                    const url = request.url();
                    if (url.includes('connect.facebook.net')) {
                        hasFacebookPixel = true;
                    }
                });
                await page.goto(this.url);
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
        async function isUsingTwitterAds(page){
            let hasTwitterPixel = false;
            try {
                page.on('request', (request) => {
                    const url = request.url();
                    if (url.includes('static.ads-twitter.com')) {
                        hasTwitterPixel = true;
                    }
                });
                await page.goto(this.url);
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
        async function isUsingPinterestAds(page) {
            let hasPinterestAds = false;
            try {
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
                await page.goto(this.url);
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
        async function isUsingGoogleAds(){
            let hasGoogleAds = false;
            try {
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
                await page.goto(this.url);
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
    }
    async techStack(){
        try {
            const {data:html} = await axios.get(this.url)
            const techStackFormat = z.array(z.string());
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    "Content-Type": 'application/json',
                    "Authorization": `Bearer ${process.env.OPENAI_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {role: "system", content: "You are an expert at structured data extraction and determining the tech stack used by a website. You will be given raw website html text data and you should extract the tech stack the website is using by looking for their signatures in the data. For example but no limited to react, vue, woocomerce, wordpress, shopify, squarespace etc. Return the extracted data following the given structure"},
                        { role: "user", content: `${html}` },
                    ],
                    response_format: zodResponseFormat(techStackFormat, "tech_stack_extraction"),
                })
            })
            const resJSON = await res.json()
            console.log(resJSON)
            
        } catch (error) {
            console.error(error.message)
        }
    }
    async serpRankingPosition(){

    }
    async webTraffic(){
        try {
            const selector = '#content > div > div > div.left > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(2)'
            const rootDomain = getRootDomain(this.url)
            const {data: html } = await axios.get(`https://www.siteworthtraffic.com/report/${rootDomain}`)
            const $ = cheerio.load(html);  
            const monthlyViews = $('#content > div > div > div.left > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(2)').text();
            return monthlyViews

        } catch (error) {
            return ''
        }
        function getRootDomain(url){
            const parsedUrl = new URL(url);
            const domain = parsedUrl.hostname;
            return domain;
        }
    }
}

async function techStack(url){
    try {
        const openai = new OpenAI({apiKey: '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'});
        const { data: html } = await axios.get(url)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {role: "system", content: "You are an expert at structured data extraction and determining the tech stack used by a website. You will be given raw website html text data and you should extract the tech stack the website is using by looking for their signatures in the data. For example but no limited to react, vue, woocomerce, wordpress, shopify, squarespace etc. Return the extracted data following the given structure"},
                { role: "user", content: `Here is the html: ${html}` },
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "text_extraction",
                    schema: {
                        type: "object",
                        properties: {
                            stacks: {
                                type: "array",
                                items: { type: "string" }
                            }
                        },
                        required: ["stacks"],
                        additionalProperties: false
                    },
                    strict: true
                }
            }
        });
        const techStack = JSON.parse(completion.choices[0].message.content)
        console.log(techStack)
        return techStack
        
    } catch (error) {
        return error.message
    }
}
techStack('https://pendora.org')
.then((result)=>{
    console.log('Results: ', result)
})
.catch((err)=>{
    console.log(err)
})