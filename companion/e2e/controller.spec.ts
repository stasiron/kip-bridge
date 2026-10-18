import { expect, test } from "@playwright/test";
import {
  clientMessages,
  disconnectIfPossible,
  joinPage,
  runtime,
  sendConsole,
  waitForFreeEndpoint,
} from "./helpers";

test.describe("controller smoke against bridge + simulator", () => {
  test("status advertises controller UI", async ({ request }) => {
    const cfg = runtime();
    const status = await request.get(`${cfg.baseURL}/api/status`);
    expect(status.ok()).toBeTruthy();
    const body = await status.json();
    expect(body.gameplay).toBe(true);
    expect(body.controllerUi).toBe(true);
    expect(JSON.stringify(body)).not.toContain(cfg.joinCode);
  });

  test("player setup, lobby, and core gameplay screens", async ({ page }) => {
    await waitForFreeEndpoint(1);
    await joinPage(page, { name: "Ada", avatar: "COWGIRL" });

    await page.getByTestId("start-button").click();
    await expect
      .poll(async () => (await clientMessages())?.messages?.some((m) => m.TypeString === "StartGameButtonPressedResponseMessage"))
      .toBeTruthy();

    await sendConsole({
      TypeString: "ClientHoldingScreenCommandMessage",
      HoldingScreenText: "Look at the TV",
      HoldingScreenType: 4,
      action: 5,
      time: 0,
      OtherPlayerIndex: -1,
      ShowPortraitPhotoControls: false,
    });
    await expect(page.getByRole("heading", { name: "Hold" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Look at the TV", { exact: true })).toBeVisible();

    await sendConsole({ TypeString: "ClientQuizCommandMessage", action: 4, time: 0 });
    await expect(page.getByTestId("continue-button")).toBeVisible();
    await page.getByTestId("continue-button").click();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerCategorySelectChoices",
      HeaderText: "Pick a door",
      CategoryChoices: [
        { DisplayText: "Science", DoorIndex: 0, ChoiceType: 0 },
        { DisplayText: "History", DoorIndex: 1, ChoiceType: 0 },
      ],
    });
    await sendConsole({ TypeString: "KnowledgeIsPower.ServerRequestCategorySelectChoice" });
    await page.getByRole("button", { name: "Science" }).click();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
      QuestionID: "q1",
      QuestionText: "Capital of France?",
      QuestionDuration: 30,
      Answers: [
        { DisplayIndex: 0, DisplayText: "Berlin", IsCorrect: false },
        { DisplayIndex: 1, DisplayText: "Paris", IsCorrect: true },
      ],
      PowerPlays: [],
      PowerPlayPlayers: [],
      RoundType: 1,
    });
    await page.getByRole("button", { name: "Paris" }).click();
    await expect(page.getByText("Answer sent")).toBeVisible();

    await sendConsole({
      TypeString: "KnowledgeIsPower.ServerBeginPowerPlayPhase",
      RoundType: 0,
      PowerPlays: [
        {
          DisplayIndex: 0,
          PowerType: 4,
          PowerTypes: [4],
          PowerTarget: 1,
          PowerPlayTargets: [],
          New: true,
          TargetCount: 0,
        },
      ],
      PowerPlayPlayers: [
        { SlotIndex: 0, Name: "Ada", ImageGUID: "", Colour: { r: 1, g: 1, b: 1, a: 1 }, Self: true, Away: false },
      ],
    });
    await page.getByTestId("power-0").click();
    await expect(page.getByText("Power choice sent")).toBeVisible();

    await sendConsole({
      TypeString: "ClientEndOfGameFactCommandMessage",
      action: 1,
      time: 0,
      FactNumber: 3,
    });
    await expect(page.getByText("End of game")).toBeVisible();
    await disconnectIfPossible(page);
  });

  test("bad join code shows useful error", async ({ page }) => {
    await waitForFreeEndpoint(1);
    const cfg = runtime();
    await page.goto("/");
    await page.getByTestId("join-code").fill("WRONGCOD");
    await page.getByTestId("console-host").fill("127.0.0.1");
    await page.getByTestId("console-port").fill(String(cfg.simPort));
    await page.getByTestId("join-button").click();
    await expect(page.getByTestId("bridge-error")).toContainText("Join code does not match the running bridge");
  });

  test("mobile viewport keeps controls usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForFreeEndpoint(1);
    await joinPage(page);
    await expect(page.getByTestId("start-button")).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId("start-button")).toBeVisible();
    await disconnectIfPossible(page);
  });
});
