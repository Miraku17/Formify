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
      doc.fontSize(14);
      
      // Apply red color if question was answered incorrectly
      if (item.isIncorrect) {
        doc.fillColor('red')
           .text(`Question ${index + 1}: [WRONG ANSWER]`, { continued: false });
      } else {
        doc.fillColor('black')
           .text(`Question ${index + 1}:`, { continued: false });
      }
      
      doc.moveDown(0.5)
         .fontSize(12)
         .text(item.question)
         .moveDown(1);

      // Answers
      item.answers.forEach((answer, ansIndex) => {
        doc.fontSize(12);
        
        // Choose color based on correct/incorrect
        if (answer.isCorrect) {
          doc.fillColor('green')
             .font('Times-Bold');
        } else {
          doc.fillColor('black')
             .font('Times-Roman');
        }
        
        doc.text(`${indexToLetter(ansIndex)}. ${answer.text}`).moveDown(0.5);
      });
      
      // Reset text color back to black for feedback
      doc.fillColor('black')
         .font('Times-Roman');

      // Feedback
      if (item.feedback) {
        doc.fontSize(12)
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
       
    // Add count of incorrect answers
    const incorrectCount = qaItems.filter(item => item.isIncorrect).length;
    if (incorrectCount > 0) {
      doc.moveDown(0.5)
         .fillColor('red')
         .text(`Incorrect Answers: ${incorrectCount}`);
    }

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
    
    // Get the raw HTML as text
    const htmlText = response.data;
    
    const $ = cheerio.load(htmlText);
    
    const formTitle = $('.F9yp7e').text().trim() || 'Form Questions and Answers';
    
    let qaItems = [];
    
    // Process each question
    $('.OxAavc').each((index, element) => {
      // Get the HTML of this question element as text
      const questionHtml = $.html(element);
      
      const question = $(element).find('span.M7eMe').text().trim();
      let answers = [];
      let feedback = '';
      
      // Extract feedback if available
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
      
      // Check if this question contains the wrong answer marker
      // Look for both English and Filipino wrong markers
      const isIncorrect = (
        // Filipino version
        (questionHtml.includes('zS667') && questionHtml.includes('Mali')) ||
        // English version
        (questionHtml.includes('zS667') && questionHtml.includes('Wrong')) ||
        // Additional classes that indicate wrong answers
        $(element).find('.NW3tIe, .zS667, .jgvuAb').length > 0
      );
      
      // Process answer options
      $(element).find('.aDTYNe.snByac, .nWQGrd').each((i, answerElem) => {
        const answerText = $(answerElem).text().trim();
        
        // Look for correct answer markers in multiple languages
        const correctIndicator = $(answerElem).closest('.yUJIWb').find('.fKfAyc');
        const correctText = correctIndicator.text().trim().toLowerCase();
        
        // Check for "Tama" (Filipino) or "Correct" (English) or other indicators
        const isCorrect = (
          correctText === 'tama' || 
          correctText === 'correct' || 
          correctText === 'right' ||
          // Visual indicators (green checkmark, etc.)
          $(answerElem).closest('.docssharedWizToggleLabeledContent, .yUJIWb').find('.SG0AAe, .F7LiGb, .uHMk6b').length > 0 ||
          // Check for stylistic indicators of correct answers (background color, etc.)
          $(answerElem).closest('.docssharedWizToggleLabeledPrimaryText, .nWQGrd').hasClass('EzyPc')
        );
        
        answers.push({
          text: answerText,
          isCorrect: isCorrect
        });
      });
      
      // If we didn't find any correct answers but this is a quiz form,
      // try a fallback approach to identify correct answers
      if (answers.length > 0 && !answers.some(a => a.isCorrect)) {
        // Look for answers with green color or check indicators
        const correctIndicators = $(element).find('.SG0AAe, .F7LiGb, .uHMk6b');
        correctIndicators.each((i, indicator) => {
          // Find the closest answer to this indicator
          const closestAnswer = $(indicator).closest('.freebirdFormviewerViewItemsRadioChoice, .freebirdFormviewerViewItemsCheckboxChoice');
          const answerIndex = closestAnswer.index();
          
          // If we found a valid index, mark that answer as correct
          if (answerIndex >= 0 && answerIndex < answers.length) {
            answers[answerIndex].isCorrect = true;
          }
        });
      }
      
      if (question && answers.length > 0) {
        qaItems.push({
          question: question,
          answers: answers,
          feedback: feedback,
          isIncorrect: isIncorrect,
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
    // Question title with WRONG marker if incorrect
    const questionTitle = item.isIncorrect 
      ? `Question ${index + 1}: [WRONG ANSWER]` 
      : `Question ${index + 1}:`;
      
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: questionTitle,
            size: 28,
            bold: true,
            color: item.isIncorrect ? "FF0000" : "000000"
          })
        ],
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
            size: 24,
            color: item.isIncorrect ? "FF0000" : "000000"
          })
        ],
        spacing: {
          after: 200
        }
      })
    );

    // Add Answers
    item.answers.forEach((answer, ansIndex) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${indexToLetter(ansIndex)}. ${answer.text}`,
              bold: answer.isCorrect,
              color: answer.isCorrect ? "008000" : "000000", // Green for correct, black for others
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
          children: [
            new TextRun({
              text: "Feedback:",
              size: 24,
              bold: true,
              color: "000000"
            })
          ],
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
                  size: 24,
                  color: "000000"
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

  // Add summary
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
        before: 400,
        after: 200
      }
    })
  );
  
  // Add count of incorrect answers
  const incorrectCount = qaItems.filter(item => item.isIncorrect).length;
  if (incorrectCount > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Incorrect Answers: ${incorrectCount}`,
            size: 24,
            bold: true,
            color: "FF0000"
          })
        ],
        spacing: {
          before: 200
        }
      })
    );
  }

  return children;
}