import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './Help.css';

const Help = () => {
  return (
    <div className="Help Box">
      <div className="Page__Title">FAQ</div>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <h3 className='Help__FAQ__Title'>How to get the app to start tracking?</h3>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            To start tracking a map, make sure the Client.txt file location is set properly in the Settings page, then start the game, open a map or any content you want to track, and travel to it. The app will start tracking the moment you get in.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <h3 className='Help__FAQ__Title'>How to tell the app that the map is complete?</h3>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            To complete a map, you have multiple options:
            <ol>
              <li>Travel to a different map</li>
              <li>Travel to a different story zone (not a town)</li>
              <li>Travel to a different league mechanic zone (Delve, Heist, etc)</li>
              <li>Message yourself <span className='Text--Magic'>end</span> (the full line is <span className='Text--Magic'>@yourCharacterName end</span>)</li>
            </ol>
            After completing one of these, the app will automatically consider the current map as completed and will give you a notification with the results on the bottom of the main window and on the overlay.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <h3 className='Help__FAQ__Title'>How to make the app track mods and IIQ/IIR/Pack Size?</h3>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            The app tracks this information by reading a screenshot of the game where the map mods are displayed.
          </Typography>
          <Typography>
            Depending how you set it up in the Settings page, it can take a screenshot and read it using <span className='Text--Magic'>CTRL+F8</span>, or it can check any new screenshot in the folder you set up.
          </Typography>
          <Typography>
            If you encounter any error, or the app doesn't read the mods, make sure the screenshot is taken properly and the mods are visible. For more help debugging, you can see the processed image it is reading in <span className='Text--Magic'>C:\Users\yourUserName\AppData\Roaming\exile-diary\.dev_captures\</span>.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <h3 className='Help__FAQ__Title'>How to make the app track the number of mobs killed in a map?</h3>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            The app tracks this information by reading info about any incubator your have active on your gear when you enter and when you leave the map.
          </Typography>
          <Typography>
            You can set up a reminder to tell you if you are missing incubators when entering a map in the Settings page.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <h3 className='Help__FAQ__Title'>How to enable/disable the ingame overlay ?</h3>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            You can completely disable the overlay in the Settings page.
          </Typography>
          <Typography>
            When enabled, the overlay will show up when you have a notification, and disappear right away. You can toggle the permanent visibility of the overlay by pressing <span className='Text--Magic'>CTRL+F7</span>. 
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <h3 className='Help__FAQ__Title'>Can I move the overlay ?</h3>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            When the overlay is activated, you can change its position by pressing <span className='Text--Magic'>CTRL+F9</span>.
          </Typography>
          <Typography>
            If you changed the size of the PoE window, the resolution, or for any reason the overlay is not on the screen anymore, you can reset its position by pressing the big button at the bottom.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <h3 className='Help__FAQ__Title'>The prices seem wrong for my recent runs, can I do something about it ?</h3>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            In the Debug section of the Settings, you have a few tools to allow you to clean up prices.
            <ol>
              <li><b>Recalculate</b>: Enter a period of time, and the app will re calculate prices for every drop you got during this period, using the latest prices the app currently has.</li>
              <li><b>Fetch Rates</b>: This button will force the app to refresh the current prices for today from PoE.ninja. Feel free to run a <b>Recalculate</b> for today once the Fetch is complete.</li>
              <li><b>Fetch Stash Tabs</b>: This button will force the app to refresh the content of your Stash Tabs. <span className='Text--Error'>Warning</span> : Doing this too much can lead to you being Rate Limited and not being able to fetch tabs for a while.</li>
            </ol>
          </Typography>
          <Typography>
            If you spot any weird pricing somewhere, feel free to use these buttons to try and correct it, and enter an issue on Discord or on Github if it still did not fix it.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <section>
        <p>
          LINKS
        </p>
      </section>
    </div>
  );
};

export default Help;
