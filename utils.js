import axios from 'axios'
import {cheerio} from 'cheerio'

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
async function extractAtags(ur){
    
}