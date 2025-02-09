import axios from 'axios';
import * as cheerio from 'cheerio';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import { NextResponse } from 'next/server';

// Helper function to convert index to letter (0 = A, 1 = B, etc.)
function indexToLetter(index) {
  return String.fromCharCode(65 + index); // 65 is ASCII for 'A'
}

async function generatePDF(qaItems, formTitle) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      autoFirstPage: true,
      size: 'A4',
      font: 'Times-Roman'
    });
    
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Add title
    doc.fontSize(24)
       .text(formTitle, { align: 'center' })
       .moveDown(2);

    // Add questions and answers
    qaItems.forEach((item, index) => {
      // Question
      doc.fontSize(14)
         .text(`Question ${index + 1}:`, { continued: false })
         .moveDown(0.5)
         .fontSize(12)
         .text(item.question)
         .moveDown(1);

      // Answers
      item.answers.forEach((answer, ansIndex) => {
        doc.fontSize(12);
        if (answer.isCorrect) {
          doc.font('Times-Bold');
        } else {
          doc.font('Times-Roman');
        }
        doc.text(`${indexToLetter(ansIndex)}. ${answer.text}`).moveDown(0.5);
      });

      // Feedback
      if (item.feedback) {
        doc.font('Times-Italic')
           .fontSize(12)
           .moveDown(0.5)
           .text('Feedback:', { continued: false })
           .moveDown(0.5)
           .text(item.feedback)
           .moveDown(1);
      }

      doc.moveDown(1);
    });

    // Add total questions count
    doc.font('Times-Bold')
       .fontSize(12)
       .moveDown(1)
       .text(`Total Questions: ${qaItems.length}`);

    doc.end();
  });
}

export async function POST(req) {
  try {
    const { formLink, fileName, fileType } = await req.json();
    
    const response = await axios.get(formLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const formTitle = $('.F9yp7e').text().trim() || 'Form Questions and Answers';
    
    let qaItems = [];
    
    $('.OxAavc').each((index, element) => {
      const question = $(element).find('span.M7eMe').text().trim();
      let answers = [];
      let feedback = '';
      
      const feedbackElement = $(element).find('.PcXV5e');
      if (feedbackElement.length > 0) {
        const contentDiv = feedbackElement.find('.sIQxvc');
        if (contentDiv.length > 0) {
          feedback = contentDiv
            .html()
            .replace(/<div[^>]*>/g, '')
            .replace(/<\/div>/g, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .join('\n');
        }
      }
      
      $(element).find('.aDTYNe.snByac').each((i, answerElem) => {
        const answerText = $(answerElem).text().trim();
        const isCorrect = $(answerElem).closest('.yUJIWb').find('.fKfAyc').text().trim() === 'Tama';
        answers.push({
          text: answerText,
          isCorrect: isCorrect
        });
      });
      
      if (question && answers.length > 0) {
        qaItems.push({
          question: question,
          answers: answers,
          feedback: feedback
        });
      }
    });

    let buffer;
    if (fileType === 'pdf') {
      buffer = await generatePDF(qaItems, formTitle);
    } else {
      const doc = new Document({
        sections: [{
          properties: {},
          children: generateDocumentContent(qaItems, formTitle)
        }]
      });
      buffer = await Packer.toBuffer(doc);
    }

    const base64 = buffer.toString('base64');

    return NextResponse.json({ 
      success: true, 
      data: base64,
      fileName: `${fileName}.${fileType}`
    });

  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An error occurred while processing the form'
    }, { status: 500 });
  }
}

function generateDocumentContent(qaItems, formTitle) {
  const children = [
    new Paragraph({
      children: [
        new TextRun({
          text: formTitle,
          size: 32,
          bold: true
        })
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: {
        after: 400
      }
    })
  ];

  qaItems.forEach((item, index) => {
    // Add Question
    children.push(
      new Paragraph({
        text: `Question ${index + 1}:`,
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 400,
          after: 200
        }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: item.question,
            size: 24
          })
        ],
        spacing: {
          after: 200
        }
      })
    );

    // Add Answers with letters
    item.answers.forEach((answer, ansIndex) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${indexToLetter(ansIndex)}. ${answer.text}`,
              bold: answer.isCorrect,
              size: 24
            })
          ],
          spacing: {
            after: 100
          }
        })
      );
    });

    // Add Feedback if exists
    if (item.feedback) {
      children.push(
        new Paragraph({
          text: 'Feedback:',
          heading: HeadingLevel.HEADING_3,
          spacing: {
            before: 200,
            after: 200
          }
        })
      );

      const feedbackLines = item.feedback.split('\n');
      feedbackLines.forEach(line => {
        if (line.trim()) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.trim(),
                  italics: true,
                  size: 24
                })
              ],
              spacing: {
                after: 100
              }
            })
          );
        }
      });
    }
  });

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Questions: ${qaItems.length}`,
          size: 24,
          bold: true
        })
      ],
      spacing: {
        before: 400
      }
    })
  );

  return children;
}