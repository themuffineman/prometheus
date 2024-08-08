import axios from 'axios'
import * as cheerio from 'cheerio'
import url from 'url'

export async function extractWebsiteData(url){

    const emails = []
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g;
    const aTags = []
    const socialMedia = []
    const socialMediaRegexes = {
        linkedin: /https?:\/\/(www\.)?linkedin\.com\/[a-zA-Z0-9-_/]+/g,
        instagram: /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9-_/]+/g,
        facebook: /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9-_/]+/g,
        twitter: /https?:\/\/(www\.)?twitter\.com\/[a-zA-Z0-9-_/]+/g,
    };

    try {
        const { data: html } = await axios.get(url)
        const $ = cheerio.load(html);

        const textContent = $('body').text()
        const matchedEmails = textContent.match(emailRegex);
        if (matchedEmails) {
            emails.push(...matchedEmails);
        }




    } catch (error) {
        
    }

}
async function getInternalLinks(pageUrl) {
    try {
        const { data: html = '' } = await axios.get(pageUrl);
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