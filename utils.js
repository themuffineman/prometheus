import axios from 'axios'
import * as cheerio from 'cheerio'
import emailValidator from 'deep-email-validator'

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

generateEmailPermutations('petrus', 'heya', 'gmail.com')
.then((result)=>{
    console.log(result)
}).catch(()=>{
    console.log('Error occured')
})


