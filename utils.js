import axios from 'axios'
import * as cheerio from 'cheerio'
import url from 'url'

function getInternalLinks(pageUrl, html) {
    try {
        const $ = cheerio.load(html);  
        const baseUrl = getRootDomain(pageUrl)
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
function getRootDomain(url) {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    return domain;
}
async function getEmails(url){
    const emails = []
    
    try {
        const initialemails = await getEmailsSinglePage(url)
        emails.push(...initialemails)
        const aTags = getInternalLinks(url, html)

        for (const link of aTags){
            const returnedEmails = await getEmailsSinglePage(link)
            emails.push(...returnedEmails)
        }

        return []
    } catch (error) {
        return []
    }
}
async function getEmailsSinglePage(url){
    const emails = []
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g;

    try {
        const { data: html } = await axios.get(url)
        const $ = cheerio.load(html);        
        const textContent = $('body').text()
        const matchedEmails = textContent.match(emailRegex);
        if (matchedEmails) {
            emails.push(...matchedEmails);
        }
        return emails
    } catch (error) {
        return []
    }

}