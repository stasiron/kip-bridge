import { expect, test } from "@playwright/test";
import {
  clientMessages,
  disconnectIfPossible,
  freshUid,
  joinPage,
  runtime,
  sendConsole,
  waitForFreeEndpoint,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("mission scenarios A–L (simulator)", () => {
  test("A+E+F+G: full single-player simulated game path", async ({ page }) => {
    await waitForFreeEndpoint(2);
    await joinPage(page, { name: "Ada", avatar: "COWGIRL" });

    await page.getByTestId("start-button").click();
    await expect
      .poll(async () => (await clientMessages())?.messages?.some((m) => m.TypeString === "StartGameButtonPressedResponseMessage"))
      .toBeTruthy();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerCategorySelectChoices",
      HeaderText: "Pick",
      CategoryChoices: [
        { DisplayText: "Science", DoorIndex: 0, ChoiceType: 0 },
        { DisplayText: "Arts", DoorIndex: 1, ChoiceType: 0 },
      ],
    });
    await sendConsole({ TypeString: "KnowledgeIsPower.ServerRequestCategorySelectChoice" });
    await page.getByRole("button", { name: "Science" }).click();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginCategorySelectOverride",
      DurationSeconds: 8,
      InitialCategorySelectChoice: "Arts",
      DoorIndex: 1,
    });
    await expect(page.getByTestId("override-button")).toBeVisible();
    await page.getByTestId("override-button").click();
    await expect(page.getByTestId("override-sent")).toBeVisible();
    await expect
      .poll(async () =>
        (await clientMessages())?.messages?.some(
          (m) => m.TypeString === "KnowledgeIsPower.ClientCategorySelectOverride" && typeof m.DurationSeconds === "number",
        ),
      )
      .toBeTruthy();
    const overrideMsg = (await clientMessages())?.messages?.find(
      (m) => m.TypeString === "KnowledgeIsPower.ClientCategorySelectOverride",
    );
    expect(Number(overrideMsg?.DurationSeconds)).toBeLessThan(8);

    await sendConsole({ TypeString: "KnowledgeIsPower.ServerStopCategorySelectOverride" });
    await expect
      .poll(async () =>
        (await clientMessages())?.messages?.some(
          (m) =>
            m.TypeString === "KnowledgeIsPower.ClientStopCategorySelectOverrideResponse" && m.OverrideSent === true,
        ),
      )
      .toBeTruthy();
    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerCategorySelectOverrideSuccess",
      CategorySelectOverrideSuccess: true,
      CategorySelectOverridePlayerName: "Ada",
    });
    await expect(page.getByText("Hold")).toBeVisible();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
      QuestionID: "q-full",
      QuestionText: "2+2?",
      QuestionDuration: 20,
      Answers: [
        { DisplayIndex: 0, DisplayText: "3", IsCorrect: false },
        { DisplayIndex: 1, DisplayText: "4", IsCorrect: true },
      ],
      PowerPlays: [],
      PowerPlayPlayers: [],
      RoundType: 1,
    });
    await page.getByRole("button", { name: "4" }).click();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginPowerPlayPhase",
      RoundType: 0,
      PowerPlays: [
        {
          DisplayIndex: 0,
          PowerType: 4,
          PowerTypes: [4],
          PowerTarget: 2,
          PowerPlayTargets: [1],
          New: true,
          TargetCount: 1,
        },
        {
          DisplayIndex: 1,
          PowerType: 5,
          PowerTypes: [5],
          PowerTarget: 4,
          PowerPlayTargets: [0, 1],
          New: false,
          TargetCount: 2,
        },
      ],
      PowerPlayPlayers: [
        { SlotIndex: 0, Name: "Ada", ImageGUID: "", Colour: { r: 1, g: 1, b: 1, a: 1 }, Self: true, Away: false },
        { SlotIndex: 1, Name: "Bob", ImageGUID: "", Colour: { r: 1, g: 0, b: 0, a: 1 }, Self: false, Away: false },
      ],
    });
    await page.getByTestId("power-0").click();
    await page.getByTestId("power-target-1").click();
    await expect(page.getByText("Power choice sent")).toBeVisible();
    await expect
      .poll(async () =>
        (await clientMessages())?.messages?.some(
          (m) =>
            m.TypeString === "KnowledgeIsPower.ClientPowerPlayChoice" &&
            m.PowerPlaySlotIndex === 0 &&
            Array.isArray(m.TargetSlotIndex) &&
            (m.TargetSlotIndex as number[])[0] === 1,
        ),
      )
      .toBeTruthy();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginLinkingAnsweringPhase",
      QuestionID: "l-full",
      QuestionText: "Link pairs now",
      QuestionDuration: 30,
      LinkingAnswers: [
        { DisplayText: "LeftCat", AnswerID: "a", MatchIndex: 1, Direction: 0 },
        { DisplayText: "RightMeow", AnswerID: "b", MatchIndex: 1, Direction: 1 },
      ],
    });
    await expect(page.getByRole("heading", { name: "Linking" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "LeftCat", exact: true }).click();
    await page.getByRole("button", { name: "RightMeow", exact: true }).click();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginSortingAnsweringPhase",
      QuestionID: "s-full",
      QuestionText: "Sort",
      LeftBucketLabel: "Yes",
      LeftBucketID: "Y",
      RightBucketLabel: "No",
      RightBucketID: "N",
      QuestionDuration: 30,
      SortingAnswers: [{ DisplayText: "Item", AnswerID: "1", AnswerDirection: 1 }],
    });
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(page.getByText("Sorting answer sent")).toBeVisible();

    await disconnectIfPossible(page);
  });

  test("B+C+D+J: two browsers, isolated messages and identities", async ({ browser }) => {
    await waitForFreeEndpoint(2);
    const cfg = runtime();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await joinPage(pageA, { name: "Ann", avatar: "COWGIRL" });
    await joinPage(pageB, { name: "Bea", avatar: "MAGICIAN" });

    const addrA = cfg.endpoints[0];
    const addrB = cfg.endpoints[1];
    const clientA = await clientMessages(addrA);
    const clientB = await clientMessages(addrB);
    expect(clientA?.playerId).toEqual(expect.any(Number));
    expect(clientB?.playerId).toEqual(expect.any(Number));
    expect(clientA?.playerId).not.toBe(clientB?.playerId);

    await sendConsole(
      {
        TypeString: "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
        QuestionID: "only-a",
        QuestionText: "Only Ann sees this?",
        QuestionDuration: 25,
        Answers: [
          { DisplayIndex: 0, DisplayText: "AnnAnswer", IsCorrect: true },
          { DisplayIndex: 1, DisplayText: "Wrong", IsCorrect: false },
        ],
        PowerPlays: [],
        PowerPlayPlayers: [],
        RoundType: 0,
      },
      addrA,
    );
    await expect(pageA.getByText("Only Ann sees this?")).toBeVisible();
    await expect(pageB.getByText("Only Ann sees this?")).toHaveCount(0);

    await pageA.getByRole("button", { name: "AnnAnswer" }).click();
    await expect
      .poll(async () =>
        (await clientMessages(addrA))?.messages?.some(
          (m) => m.TypeString === "KnowledgeIsPower.ClientTriviaAnswer" && m.ChosenAnswerDisplayIndex === 0,
        ),
      )
      .toBeTruthy();
    expect(
      (await clientMessages(addrB))?.messages?.some(
        (m) => m.TypeString === "KnowledgeIsPower.ClientTriviaAnswer" && m.ChosenAnswerDisplayIndex === 0,
      ),
    ).toBeFalsy();

    await disconnectIfPossible(pageA);
    await disconnectIfPossible(pageB);
    await ctxA.close();
    await ctxB.close();
  });

  test("H+I+J: disconnect one player, reconnect, peer stays", async ({ browser }) => {
    await waitForFreeEndpoint(2);
    const cfg = runtime();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    const uidA = freshUid("dee");
    await joinPage(pageA, { uid: uidA, name: "Dee", avatar: "COWGIRL" });
    await joinPage(pageB, { name: "Eve", avatar: "MAGICIAN" });

    await sendConsole(
      {
        TypeString: "ClientHoldingScreenCommandMessage",
        HoldingScreenText: "Eve hold steady",
        HoldingScreenType: 4,
        action: 5,
        time: 0,
        OtherPlayerIndex: -1,
        ShowPortraitPhotoControls: false,
      },
      cfg.endpoints[1],
    );
    await expect(pageB.getByText("Eve hold steady")).toBeVisible();

    await disconnectIfPossible(pageA);
    await expect(pageB.getByText("Eve hold steady")).toBeVisible();
    await expect(pageB.getByTestId("disconnect-button")).toBeVisible();

    // Same UID rejoins via stored simulator profile (setup form skipped).
    await pageA.goto("/");
    await pageA.getByTestId("join-code").fill(cfg.joinCode);
    await pageA.getByTestId("console-host").fill("127.0.0.1");
    await pageA.getByTestId("console-port").fill(String(cfg.simPort));
    await pageA.getByTestId("join-button").click();
    await expect(pageA.getByTestId("disconnect-button")).toBeVisible({ timeout: 12_000 });
    await expect(pageB.getByText("Eve hold steady")).toBeVisible();

    await disconnectIfPossible(pageA);
    await disconnectIfPossible(pageB);
    await ctxA.close();
    await ctxB.close();
  });

  test("K: background / visibility reconnect restores WS", async ({ page }) => {
    await waitForFreeEndpoint(1);
    await joinPage(page, { name: "Fay", avatar: "COWGIRL" });
    await sendConsole({
      TypeString: "ClientHoldingScreenCommandMessage",
      HoldingScreenText: "Background hold",
      HoldingScreenType: 9,
      action: 5,
      time: 0,
      OtherPlayerIndex: -1,
      ShowPortraitPhotoControls: false,
    });
    await expect(page.getByText("Background hold")).toBeVisible();

    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.getByText("Background hold")).toBeVisible();
    await page.reload();
    const cfg = runtime();
    await page.getByTestId("join-code").fill(cfg.joinCode);
    await page.getByTestId("console-host").fill("127.0.0.1");
    await page.getByTestId("console-port").fill(String(cfg.simPort));
    await page.getByTestId("join-button").click();
    await expect(page.getByText("Background hold")).toBeVisible({ timeout: 10_000 });
    await disconnectIfPossible(page);
  });

  test("L: console unavailable yields connect_timeout", async ({ page }) => {
    await waitForFreeEndpoint(1);
    const cfg = runtime();
    await page.goto("/");
    await page.getByTestId("join-code").fill(cfg.joinCode);
    await page.getByTestId("console-host").fill("127.0.0.1");
    await page.getByTestId("console-port").fill("1");
    await page.getByTestId("join-button").click();
    await expect(page.getByTestId("bridge-error")).toContainText(/connect_timeout|Console did not complete/i, {
      timeout: 5_000,
    });
  });

  test("decades screens accept an answer on the simulator", async ({ page }) => {
    await waitForFreeEndpoint(1);
    await joinPage(page, { name: "Dee", avatar: "COWGIRL" });

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginOrderingAnsweringPhase",
      ChallengeId: "ord-1",
      QuestionText: "Order decades",
      QuestionDuration: 30,
      OrderingAnswerData: [{ WordsInCorrectOrder: ["Alpha", "Beta"], LayoutId: 0 }],
    });
    await expect(page.getByRole("heading", { name: "Ordering" })).toBeVisible();
    await page.getByRole("button", { name: "Alpha", exact: true }).click();
    await page.getByRole("button", { name: "Beta", exact: true }).click();
    await page.getByRole("button", { name: "Submit order" }).click();
    await expect
      .poll(async () =>
        (await clientMessages())?.messages?.some((m) => m.TypeString === "KnowledgeIsPower.ClientToServerOrderingAnswer"),
      )
      .toBeTruthy();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginEliminatingAnsweringPhase",
      ChallengeId: "elim-1",
      QuestionText: "Drop one",
      QuestionDuration: 30,
      EliminatingAnswerData: [
        { CorrectInfo: "keep", IncorrectInfo: "drop", CorrectAnswer: "Keep", IncorrectAnswers: ["Drop"] },
      ],
    });
    await expect(page.getByRole("heading", { name: "Elimination" })).toBeVisible();
    await page.getByRole("button", { name: "Keep", exact: true }).click();
    await expect
      .poll(async () =>
        (await clientMessages())?.messages?.some((m) => m.TypeString === "KnowledgeIsPower.ClientToServerEliminatingAnswer"),
      )
      .toBeTruthy();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginMissingLetterAnsweringPhase",
      ChallengeId: "letter-1",
      Question: "Letter",
      QuestionDuration: 30,
      MissingLetterAnswerData: [{ answerInfo: "info", correct: "A", letters: "AB", finalDisplay: "_B" }],
    });
    await expect(page.getByRole("heading", { name: "Missing letter" })).toBeVisible();
    await page.getByRole("button", { name: "A", exact: true }).click();
    await expect
      .poll(async () =>
        (await clientMessages())?.messages?.some(
          (m) => m.TypeString === "KnowledgeIsPower.PrototypeClientToServerMissingLetterAnswer",
        ),
      )
      .toBeTruthy();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginMatchingAnsweringPhase",
      ChallengeId: "match-1",
      QuestionDuration: 30,
      MatchingData: [{ QuestionText: "MatchQ", AnswerText: "MatchA" }],
      DummyAnswerData: ["Nope"],
    });
    await expect(page.getByRole("heading", { name: "Matching" })).toBeVisible();
    await expect(page.getByText("MatchQ")).toBeVisible();
    await page.getByRole("button", { name: "MatchA", exact: true }).click();
    await expect(page.getByText("Matching complete")).toBeVisible();
    await disconnectIfPossible(page);
  });
});
